import api from './api';
import type {
  Comment,
  ApiResponse,
  CreateCommentData,
  UpdateCommentData
} from '../types';

class CommentService {
  // Create a new comment
  async createComment(bugId: string, data: CreateCommentData): Promise<Comment> {
    const response = await api.post<ApiResponse<{ comment: Comment }>>(
      `/bugs/${bugId}/comments`,
      data
    );
    return response.data.data!.comment;
  }

  // Get comments for a bug
  async getComments(bugId: string): Promise<Comment[]> {
    const response = await api.get<ApiResponse<{ comments: Comment[]; count: number }>>(
      `/bugs/${bugId}/comments`
    );
    return response.data.data!.comments;
  }

  // Get a single comment
  async getCommentById(id: string): Promise<Comment> {
    const response = await api.get<ApiResponse<{ comment: Comment }>>(
      `/comments/${id}`
    );
    return response.data.data!.comment;
  }

  // Update a comment
  async updateComment(id: string, data: UpdateCommentData): Promise<Comment> {
    const response = await api.put<ApiResponse<{ comment: Comment }>>(
      `/comments/${id}`,
      data
    );
    return response.data.data!.comment;
  }

  // Delete a comment
  async deleteComment(id: string): Promise<void> {
    await api.delete(`/comments/${id}`);
  }

  // Get replies for a comment
  async getCommentReplies(id: string): Promise<Comment[]> {
    const response = await api.get<ApiResponse<{ replies: Comment[]; count: number }>>(
      `/comments/${id}/replies`
    );
    return response.data.data!.replies;
  }
}

export default new CommentService();