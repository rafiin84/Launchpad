import type { Post, PostType, PostVisibility } from '../types';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let posts: Post[] = [];

export const postsService = {
  async getFeed(options?: { type?: PostType; visibility?: PostVisibility }): Promise<Post[]> {
    await delay(300);
    let result = [...posts];
    if (options?.type) result = result.filter((p) => p.type === options.type);
    if (options?.visibility) result = result.filter((p) => p.visibility === options.visibility);
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getPostById(id: string): Promise<Post | undefined> {
    await delay(150);
    return posts.find((p) => p.id === id);
  },

  async createPost(post: Omit<Post, 'id' | 'createdAt' | 'reactions' | 'comments'>): Promise<Post> {
    await delay(400);
    const newPost: Post = {
      ...post,
      id: `p-${Date.now()}`,
      createdAt: new Date().toISOString(),
      reactions: [],
      comments: [],
    };
    posts = [newPost, ...posts];
    return newPost;
  },

  async reactToPost(postId: string, emoji: string): Promise<Post> {
    await delay(200);
    posts = posts.map((p) => {
      if (p.id !== postId) return p;
      const existing = p.reactions.find((r) => r.emoji === emoji);
      if (existing) {
        return {
          ...p,
          reactions: p.reactions.map((r) =>
            r.emoji === emoji
              ? { ...r, count: r.userReacted ? r.count - 1 : r.count + 1, userReacted: !r.userReacted }
              : r
          ),
        };
      }
      return { ...p, reactions: [...p.reactions, { emoji, count: 1, userReacted: true }] };
    });
    return posts.find((p) => p.id === postId)!;
  },
};
