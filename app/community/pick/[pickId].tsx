import {
  View, Text, FlatList, TextInput, Pressable,
  KeyboardAvoidingView, Platform, Alert
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../lib/supabase";
import { PickCard } from "../../../components/community/PickCard";
import { LoadingState } from "../../../components/ui/LoadingState";
import { PostPickSheet } from "../../../components/community/PostPickSheet";
import { useLikePick, useCopyPick, useLikedPickIds, useCopiedPickIds } from "../../../hooks/useCommunityFeed";
import { useAuthStore } from "../../../stores/auth";
import { formatDistanceToNow } from "date-fns";
import type { CommunityPick, Comment } from "../../../types";

// ── Comment item ───────────────────────────────────────────────────────────────
function CommentRow({ comment, currentUserId }: { comment: Comment; currentUserId?: string }) {
  const qc = useQueryClient();
  const [upvoted, setUpvoted] = useState(false);

  async function handleUpvote() {
    if (!currentUserId) return;
    if (upvoted) {
      await supabase.from("comment_upvotes").delete()
        .match({ comment_id: comment.id, user_id: currentUserId });
      setUpvoted(false);
    } else {
      await supabase.from("comment_upvotes").insert({ comment_id: comment.id, user_id: currentUserId });
      setUpvoted(true);
    }
    qc.invalidateQueries({ queryKey: ["comments"] });
  }

  const username = comment.profiles?.username ?? "User";
  const initials = username.slice(0, 2).toUpperCase();
  const colors = ["#6366F1","#EC4899","#F59E0B","#10B981","#3B82F6"];
  const avatarColor = colors[username.charCodeAt(0) % colors.length];

  return (
    <View style={{ flexDirection: "row", paddingHorizontal: 14, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: "#111115", gap: 10 }}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: avatarColor + "25",
        alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Text style={{ color: avatarColor, fontWeight: "700", fontSize: 11 }}>{initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <Text style={{ color: "#D1D5DB", fontWeight: "600", fontSize: 13 }}>{username}</Text>
          <Text style={{ color: "#374151", fontSize: 11 }}>
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </Text>
        </View>
        <Text style={{ color: "#9CA3AF", fontSize: 14, lineHeight: 20 }}>{comment.body}</Text>
        <Pressable
          style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}
          onPress={handleUpvote}
        >
          <Text style={{ fontSize: 13 }}>{upvoted ? "👍" : "👍"}</Text>
          <Text style={{ color: upvoted ? "#818CF8" : "#374151", fontSize: 12, fontWeight: "600" }}>
            {(comment.upvote_count ?? 0) + (upvoted ? 1 : 0)}
          </Text>
          <Text style={{ color: "#374151", fontSize: 11, marginLeft: 2 }}>helpful</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function PickDetailScreen() {
  const { pickId } = useLocalSearchParams<{ pickId: string }>();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const qc = useQueryClient();

  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [counterMode, setCounterMode] = useState(false);
  const [showCounterSheet, setShowCounterSheet] = useState(false);

  const { data: pick } = useQuery<CommunityPick | null>({
    queryKey: ["pick", pickId],
    queryFn: async () => {
      const { data } = await supabase
        .from("picks")
        .select("*, profiles(username, avatar_url)")
        .eq("id", pickId)
        .single();
      return data as CommunityPick | null;
    },
  });

  const { mutate: likePick } = useLikePick();
  const { mutate: copyPick } = useCopyPick();
  const { data: likedIds = new Set() } = useLikedPickIds();
  const { data: copiedIds = new Set() } = useCopiedPickIds();

  // Load + real-time subscribe to comments
  useEffect(() => {
    if (!pickId) return;

    supabase
      .from("pick_comments")
      .select("*, profiles(username, avatar_url)")
      .eq("pick_id", pickId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setComments((data ?? []) as Comment[]));

    const channel = supabase
      .channel(`comments:${pickId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pick_comments", filter: `pick_id=eq.${pickId}` },
        async (payload) => {
          const { data } = await supabase
            .from("pick_comments")
            .select("*, profiles(username, avatar_url)")
            .eq("id", payload.new.id)
            .single();
          if (data) setComments((prev) => [...prev, data as Comment]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [pickId]);

  const { mutate: postComment, isPending: posting } = useMutation({
    mutationFn: async (body: string) => {
      if (!user) throw new Error("Sign in to comment");
      await supabase.from("pick_comments").insert({
        pick_id: pickId,
        user_id: user.id,
        body: body.trim(),
      });
    },
    onSuccess: () => {
      setCommentText("");
      qc.invalidateQueries({ queryKey: ["pick", pickId] });
    },
    onError: (e) => Alert.alert("Error", e.message),
  });

  if (!pick) return <LoadingState />;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#0A0A0D" }}
    >
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CommentRow comment={item} currentUserId={user?.id} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <View>
            {/* Pick card */}
            <View style={{ padding: 12 }}>
              <PickCard
                pick={pick}
                isLiked={likedIds.has(pick.id)}
                isCopied={copiedIds.has(pick.id)}
                onLike={() => {
                  if (!user) { router.push("/(modals)/auth" as any); return; }
                  likePick({ pickId: pick.id, liked: likedIds.has(pick.id) });
                }}
                onCopy={() => {
                  if (!user) { router.push("/(modals)/auth" as any); return; }
                  copyPick(pick.id);
                }}
              />
            </View>

            {/* Actions */}
            <View style={{ flexDirection: "row", paddingHorizontal: 14, paddingBottom: 12, gap: 8 }}>
              <Pressable
                style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                  gap: 6, paddingVertical: 9, borderRadius: 10, backgroundColor: "#1A1A1F",
                  borderWidth: 1, borderColor: "#27272A" }}
                onPress={() => {
                  if (!user) { router.push("/(modals)/auth" as any); return; }
                  copyPick(pick.id);
                }}
              >
                <Text style={{ fontSize: 15 }}>📋</Text>
                <Text style={{ color: copiedIds.has(pick.id) ? "#818CF8" : "#9CA3AF", fontSize: 13, fontWeight: "600" }}>
                  {copiedIds.has(pick.id) ? "Copied" : "Copy Pick"}
                </Text>
              </Pressable>
              <Pressable
                style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                  gap: 6, paddingVertical: 9, borderRadius: 10, backgroundColor: "#1A1A1F",
                  borderWidth: 1, borderColor: "#27272A" }}
                onPress={() => {
                  if (!user) { router.push("/(modals)/auth" as any); return; }
                  setShowCounterSheet(true);
                }}
              >
                <Text style={{ fontSize: 15 }}>↩️</Text>
                <Text style={{ color: "#F87171", fontSize: 13, fontWeight: "600" }}>Counter Pick</Text>
              </Pressable>
            </View>

            {/* Comments header */}
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8,
              borderTopWidth: 1, borderTopColor: "#111115" }}>
              <Text style={{ color: "#6B7280", fontSize: 13, fontWeight: "600" }}>
                {comments.length} {comments.length === 1 ? "Comment" : "Comments"}
              </Text>
              <View style={{ flex: 1 }} />
              <Text style={{ color: "#374151", fontSize: 11 }}>sorted by newest</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 24 }}>
            <Text style={{ color: "#374151", fontSize: 14 }}>No comments yet — start the discussion</Text>
          </View>
        }
      />

      {/* Comment input */}
      <View style={{ flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 12, paddingVertical: 10,
        borderTopWidth: 1, borderTopColor: "#111115", backgroundColor: "#0A0A0D", gap: 8 }}>
        <TextInput
          style={{ flex: 1, backgroundColor: "#111115", borderRadius: 12, paddingHorizontal: 14,
            paddingVertical: 10, color: "#F9FAFB", fontSize: 14, maxHeight: 100, borderWidth: 1, borderColor: "#1F1F23" }}
          value={commentText}
          onChangeText={setCommentText}
          placeholder={user ? "Ask a question, counter the pick, add context..." : "Sign in to comment"}
          placeholderTextColor="#374151"
          editable={!!user}
          multiline
        />
        <Pressable
          style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
            backgroundColor: commentText.trim() && !posting ? "#22C55E" : "#1A1A1F" }}
          onPress={() => commentText.trim() && postComment(commentText)}
          disabled={!commentText.trim() || posting}
        >
          <Text style={{ color: commentText.trim() ? "#fff" : "#374151", fontWeight: "700", fontSize: 13 }}>
            {posting ? "..." : "Post"}
          </Text>
        </Pressable>
      </View>

      {/* Counter pick sheet — prefills matchup from original pick */}
      <PostPickSheet
        visible={showCounterSheet}
        onClose={() => setShowCounterSheet(false)}
        prefill={{
          sport: pick.sport,
          matchup: pick.matchup,
          game_id: pick.game_id,
        }}
      />
    </KeyboardAvoidingView>
  );
}
