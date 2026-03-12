// 认证服务核心接口定义

export interface User {
  id: string;
  username: string;
  email: string | null;
  role: string;
  emailVerified: boolean;
  banned?: boolean;
}

export interface Agent {
  id: string;
  userId: string;
  name: string;
  token: string;
  isShadow: boolean;
  trustMode?: 'confirm' | 'full';
  allowedLocations?: string[];
  isOnline?: boolean;
  description?: string | null;
  avatarPath?: string | null;
  searchable?: number | null;
  frozen?: number;
  createdAt?: Date;
}

export interface AgentBasic {
  id: string;
  name: string;
}

export interface AgentWithOwner {
  id: string;
  userId: string;
  name: string;
  isShadow: boolean;
  isOnline?: boolean;
  frozen?: number;
  description?: string | null;
  createdAt?: Date;
  ownerName?: string | null;
}

export interface OverviewStats {
  userCount: number;
  agentCount: number;
  onlineAgents: number;
}

export interface UsersResult {
  users: Array<{
    id: string;
    username: string;
    email: string | null;
    role: string;
    banned: number | null;
    emailVerified: boolean;
    createdAt: Date;
  }>;
  total: number;
}

/**
 * 认证服务接口
 * 定义所有认证相关的核心方法
 */
export interface IAuthService {
  // === 用户认证方法 ===

  /**
   * 用户注册
   */
  register(username: string, email: string, password: string): Promise<{ id: string; username: string; email: string }>;

  /**
   * 用户登录
   */
  login(username: string, password: string): Promise<User>;

  /**
   * 验证邮箱
   */
  verifyEmail(email: string, code: string): Promise<User>;

  /**
   * 重新发送验证码
   */
  resendCode(email: string): Promise<void>;

  /**
   * OAuth 用户查找或创建
   */
  findOrCreateOAuthUser(
    provider: 'google' | 'github',
    providerId: string,
    email: string,
    name: string
  ): Promise<User>;

  /**
   * 根据ID获取用户
   */
  getUserById(userId: string): Promise<User>;

  /**
   * 修改密码
   */
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>;

  // === Agent 管理方法 ===

  /**
   * 创建 Agent
   */
  createAgent(userId: string, name: string): Promise<Agent>;

  /**
   * 获取或创建用户绑定的 Shadow Agent
   */
  getOrCreateShadowAgent(userId: string): Promise<Agent>;

  /**
   * 使用用户身份映射为 Shadow Agent Session
   */
  authenticateShadowAgent(userId: string): Promise<import('../../types/index.js').AgentSession>;

  /**
   * Agent 认证（Token → AgentSession）
   */
  authenticateAgent(token: string): Promise<import('../../types/index.js').AgentSession>;

  /**
   * 获取用户的所有 Agent
   */
  getAgentsByUser(userId: string): Promise<Agent[]>;

  /**
   * 删除 Agent
   */
  deleteAgent(agentId: string, userId: string): Promise<void>;

  /**
   * 更新 Agent 信任模式
   */
  updateAgentTrustMode(agentId: string, userId: string, trustMode: 'confirm' | 'full'): Promise<void>;

  /**
   * 更新 Agent 信息
   */
  updateAgent(
    agentId: string,
    userId: string,
    fields: {
      name?: string;
      description?: string;
      avatarPath?: string;
      searchable?: number;
    }
  ): Promise<void>;

  /**
   * 获取 Agent 允许的地点列表
   */
  getAgentLocations(agentId: string, userId: string): Promise<string[]>;

  /**
   * 更新 Agent 允许的地点列表
   */
  updateAgentLocations(agentId: string, userId: string, locations: string[]): Promise<void>;
}

/**
 * 管理员服务接口
 * 用户管理、Agent 管理、统计等管理员操作
 * 由 AdminService (core/admin/service.ts) 实现
 */
export interface IAdminService {
  /**
   * 获取所有用户（管理员）
   */
  getAllUsers(search?: string, limit?: number, offset?: number): Promise<UsersResult>;

  /**
   * 封禁/解封用户
   */
  banUser(userId: string, banned: boolean): Promise<void>;

  /**
   * 获取所有 Agent（管理员）
   */
  getAllAgents(): Promise<AgentWithOwner[]>;

  /**
   * 获取所有 Agent 基本信息
   */
  getAllAgentsBasic(): Promise<AgentBasic[]>;

  /**
   * 冻结/解冻 Agent
   */
  freezeAgent(agentId: string, frozen: boolean): Promise<void>;

  /**
   * 获取概览统计信息
   */
  getOverviewStats(): Promise<OverviewStats>;
}
