import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import moment from 'moment';
import { useToaster } from '../Toaster';

const PostCard = ({ post, currentUser, onUpdate, onDelete }) => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToaster();
  const [liking, setLiking] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [messaging, setMessaging] = useState(false);

  // Debug: Log post author data when component mounts
  useEffect(() => {
    // console.log('PostCard - Author data:', {
    //   name: post.author?.name,
    //   profileImage: post.author?.profileImage,
    //   hasProfileImage: !!post.author?.profileImage,
    //   fullImageUrl: post.author?.profileImage ? `/uploads/${post.author.profileImage}` : null,
    //   windowLocation: window.location.origin,
    //   completeImageUrl: post.author?.profileImage ? `${window.location.origin}/uploads/${post.author.profileImage}` : null
    // });

    // Test image loading if profile image exists
    if (post.author?.profileImage) {
      const img = new Image();
      const imageUrl = post.author.profileImage.startsWith('http') ? post.author.profileImage : `http://localhost:5001/uploads/${post.author.profileImage}`;
      
      img.onload = () => {
        // console.log('✅ Image loads successfully:', imageUrl);
      };
      img.onerror = () => {
        // console.log('❌ Image fails to load:', imageUrl);
        // console.log('Full URL attempted:', imageUrl);
      };
      img.src = imageUrl;
    }
  }, [post.author]);

  const handleLike = async () => {
    if (liking) return;
    
    setLiking(true);
    try {
      const response = await axios.post(`/api/posts/${post._id}/like`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      onUpdate(post._id, {
        isLikedByUser: response.data.isLiked,
        likeCount: response.data.likeCount
      });
      
      if (response.data.isLiked) {
        showSuccess('Post liked successfully!');
      } else {
        showSuccess('Post unliked successfully!');
      }
    } catch (error) {
      console.error('Error liking post:', error);
      showError('Failed to like/unlike post');
    } finally {
      setLiking(false);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || commenting) return;

    let cleanedComment = newComment.trim();
    const userName = currentUser?.name;
    
    if (userName) {
      // Check if the comment starts with the user's name (with optional colon)
      const namePattern = new RegExp(`^${userName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:?\\s*`, 'i');
      if (namePattern.test(cleanedComment)) {
        cleanedComment = cleanedComment.replace(namePattern, '').trim();
      }
      
      // Additional check for name anywhere in the comment
      if (cleanedComment.toLowerCase().includes(userName.toLowerCase())) {
        showError('Please don\'t include your name in the comment. Your name will be displayed automatically.');
        return;
      }
      
      // If after cleaning, the comment is empty or too short, ask for more content
      if (cleanedComment.length < 1) {
        showError('Please write a meaningful comment without including your name.');
        return;
      }
    }

    setCommenting(true);
    try {
      const response = await axios.post(`/api/posts/${post._id}/comment`, {
        content: cleanedComment
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      // Add the new comment to the post
      const updatedPost = {
        ...post,
        comments: [...post.comments, response.data.comment],
        commentCount: response.data.commentCount
      };
      onUpdate(post._id, updatedPost);
      setNewComment('');
      showSuccess('Comment added successfully!');
    } catch (error) {
      console.error('Error adding comment:', error);
      showError('Failed to add comment');
    } finally {
      setCommenting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;

    setDeleting(true);
    try {
      await axios.delete(`/api/posts/${post._id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      onDelete(post._id);
      showSuccess('Post deleted successfully!');
    } catch (error) {
      console.error('Error deleting post:', error);
      showError('Failed to delete post');
    } finally {
      setDeleting(false);
    }
  };

  const handleMessageUser = async () => {
    setMessaging(true);
    try {
      // Start conversation with this post author
      const response = await axios.get(`/api/messages/start/${post.author._id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      // Navigate to messages page with conversation started
      navigate('/messages', { 
        state: { 
          startConversation: {
            conversationId: response.data.conversationId,
            otherUser: response.data.otherUser
          }
        }
      });
    } catch (error) {
      console.error('Error starting conversation:', error);
      showError('Failed to start conversation. Please try again.');
    } finally {
      setMessaging(false);
    }
  };

  const handleMessage = async (faculty) => {
    setMessaging(true);
    try {
      // Start conversation with this faculty member
      const response = await axios.get(`/api/messages/start/${faculty._id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      // Navigate to messages page with conversation started
      navigate('/messages', { 
        state: { 
          startConversation: {
            conversationId: response.data.conversationId,
            otherUser: response.data.otherUser
          }
        }
      });
    } catch (error) {
      console.error('Error starting conversation:', error);
      alert('Failed to start conversation. Please try again.');
    } finally {
      setMessaging(false);
    }
  };

  const formatTime = (timestamp) => {
    const now = moment();
    const postTime = moment(timestamp);
    const diffMinutes = now.diff(postTime, 'minutes');
    const diffHours = now.diff(postTime, 'hours');
    const diffDays = now.diff(postTime, 'days');

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return postTime.format('MMM D, YYYY');
  };

  const renderProfileImage = (author) => {
    if (!author?.profileImage) {
      return (
        <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
          <span className="text-gray-600 font-semibold text-sm">
            {author?.name?.charAt(0)?.toUpperCase() || 'U'}
          </span>
        </div>
      );
    }

    return (
      <img
        src={author.profileImage.startsWith('http') ? author.profileImage : `http://localhost:5001/uploads/${author.profileImage}`}
        alt={author.name}
        className="w-10 h-10 rounded-full object-cover"
        onLoad={() => {
          // console.log('Profile image loaded successfully for:', author.name, 'Image:', author.profileImage.startsWith('http') ? author.profileImage : `http://localhost:5001/uploads/${author.profileImage}`);
        }}
        onError={(e) => {
          // console.log('Profile image load error for:', author.name, 'Image:', e.target.src);
          // console.log('Full image URL:', e.target.src);
          e.target.style.display = 'none';
          e.target.nextSibling.style.display = 'flex';
        }}
      />
    );
  };

  const renderComment = (comment) => {
    return (
      <div key={comment._id} className="flex items-start space-x-3 py-2">
        <div className="flex-shrink-0">
          {comment.author?.profileImage ? (
            <img
              src={comment.author.profileImage.startsWith('http') ? comment.author.profileImage : `http://localhost:5001/uploads/${comment.author.profileImage}`}
              alt={comment.author.name}
              className="w-8 h-8 rounded-full object-cover"
              onError={(e) => {
                // console.log('Image load error:', e.target.src);
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : (
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
              <span className="text-gray-600 font-semibold text-xs">
                {comment.author?.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-900">
              {comment.author?.name || 'Unknown User'}
            </span>
            <span className="text-xs text-gray-500">
              {formatTime(comment.createdAt)}
            </span>
          </div>
          <p className="text-sm text-gray-700 mt-1">{comment.content}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow duration-300">
      {/* Post Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-start space-x-2">
            {/* Author Avatar */}
            <div className="flex-shrink-0">
              {post.author && post.author.profileImage ? (
                <img
                  className="h-12 w-12 rounded-full object-cover border-2 border-gray-200"
                  src={post.author.profileImage.startsWith('http') ? post.author.profileImage : `http://localhost:5001/uploads/${post.author.profileImage}`}
                  alt={post.author.name || 'User'}
                  onLoad={() => {
                    // console.log('Profile image loaded successfully for:', post.author.name, 'Image:', post.author.profileImage.startsWith('http') ? post.author.profileImage : `http://localhost:5001/uploads/${post.author.profileImage}`);
                  }}
                  onError={(e) => {
                    // console.log('Profile image load error for:', post.author.name, 'Image:', e.target.src);
                    // console.log('Full image URL:', e.target.src);
                    e.target.style.display = 'none';
                  }}
                />
              ) : null}
            </div>

            {/* Author Info */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-semibold text-gray-900 truncate">
                  {post.author?.name || 'Unknown'}
                </h3>
                {post.author?.role === 'student' && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Student
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <span>{post.author?.department || 'N/A'}</span>
                <span>•</span>
                <span>{formatTime(post.timestamp)}</span>
              </div>
            </div>
          </div>

          {/* Action Menu */}
          <div className="flex items-center space-x-2">
            {/* Message Button */}
            {currentUser?._id && post.author?._id && currentUser._id !== post.author._id && (
              <button
                onClick={handleMessageUser}
                disabled={messaging}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                title={messaging ? "Opening conversation..." : `Send message to ${post.author.name}`}
              >
                {messaging ? (
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8s-9-3.582-9-8 4.03-8 9-8 9 3.582 9 8z" />
                  </svg>
                )}
              </button>
            )}

            {/* Delete Button (Author or Admin only) */}
            {((currentUser?._id && post.author?._id && currentUser._id === post.author._id) || currentUser?.role === 'admin') && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors duration-200"
                title="Delete post"
              >
                {deleting ? (
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Post Content */}
      <div className="px-6 pb-4">
        <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">
          {post.content}
        </p>
      </div>

      {/* Post Stats */}
      <div className="px-6 py-3 border-t border-gray-100">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center space-x-4">
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {post.likeCount} {post.likeCount === 1 ? 'like' : 'likes'}
            </span>
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8s-9-3.582-9-8 4.03-8 9-8 9 3.582 9 8z" />
              </svg>
              {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-6 py-3 border-t border-gray-100">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleLike}
            disabled={liking}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
              post.isLikedByUser
                ? 'text-red-600 bg-red-50 hover:bg-red-100'
                : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
            }`}
          >
            {liking ? (
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill={post.isLikedByUser ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            )}
            <span>Like</span>
          </button>

          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center space-x-2 px-4 py-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8s-9-3.582-9-8 4.03-8 9-8 9 3.582 9 8z" />
            </svg>
            <span>Comment</span>
          </button>
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="border-t border-gray-100">
          {/* Add Comment */}
          <div className="p-3 border-b border-gray-100">
            <form onSubmit={handleComment} className="flex space-x-3">
              <div className="flex-shrink-0">
                {currentUser?.profileImage ? (
                  <img
                    className="h-8 w-8 rounded-full object-cover"
                    src={currentUser.profileImage.startsWith('http') ? currentUser.profileImage : `http://localhost:5001/uploads/${currentUser.profileImage}`}
                    alt={currentUser.name}
                  />
                ) : null}
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={commenting}
                />
              </div>
              <button
                type="submit"
                disabled={!newComment.trim() || commenting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {commenting ? 'Posting...' : 'Post'}
              </button>
            </form>
          </div>

          {/* Comments List */}
          <div className="max-h-64 overflow-y-auto">
            {post.comments.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No comments yet. Be the first to comment!
              </div>
            ) : (
              post.comments.map((comment, index) => {
                // console.log('Comment author data:', comment.author); // Debug log
                return (
                <div key={index} className="p-3 border-b border-gray-100 last:border-b-0">
                  <div className="flex space-x-3">
                    <div className="flex-shrink-0">
                      {comment.author?.profileImage ? (
                        <img
                          className="h-8 w-8 rounded-full object-cover"
                          src={comment.author.profileImage.startsWith('http') ? comment.author.profileImage : `http://localhost:5001/uploads/${comment.author.profileImage}`}
                          alt={comment.author.name || 'User'}
                          onError={(e) => {
                            // console.log('Image load error:', e.target.src);
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : null}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-semibold text-gray-900">
                          {comment.author?.name || 'Anonymous'}
                        </h4>
                        <span className="text-xs text-gray-500">
                          {formatTime(comment.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                </div>
              )})
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PostCard; 