// Cart Session Model
// Database model definitions and business logic for CartSession entity

import { PrismaClient } from '../generated/prisma';
import { CartSession, CreateSessionDto, SessionContext } from '../types/cart.types';

export class CartSessionModel {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new session
   */
  async create(data: CreateSessionDto): Promise<CartSession> {
    const session = await this.prisma.cartSession.create({
      data: {
        userId: data.userId || null,
        sessionToken: data.sessionToken,
        expiresAt: data.expiresAt
      }
    });

    return this.mapPrismaSessionToCartSession(session);
  }

  /**
   * Find session by token
   */
  async findByToken(sessionToken: string): Promise<CartSession | null> {
    const session = await this.prisma.cartSession.findUnique({
      where: { sessionToken }
    });

    return session ? this.mapPrismaSessionToCartSession(session) : null;
  }

  /**
   * Find session by ID
   */
  async findById(id: string): Promise<CartSession | null> {
    const session = await this.prisma.cartSession.findUnique({
      where: { id }
    });

    return session ? this.mapPrismaSessionToCartSession(session) : null;
  }

  /**
   * Find active sessions by user ID
   */
  async findActiveByUserId(userId: string): Promise<CartSession[]> {
    const sessions = await this.prisma.cartSession.findMany({
      where: {
        userId,
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return sessions.map(session => this.mapPrismaSessionToCartSession(session));
  }

  /**
   * Update session expiry
   */
  async updateExpiry(id: string, expiresAt: Date): Promise<CartSession> {
    const session = await this.prisma.cartSession.update({
      where: { id },
      data: {
        expiresAt,
        updatedAt: new Date()
      }
    });

    return this.mapPrismaSessionToCartSession(session);
  }

  /**
   * Extend session expiry
   */
  async extendSession(id: string, hoursToAdd: number = 24): Promise<CartSession> {
    const currentSession = await this.prisma.cartSession.findUnique({
      where: { id }
    });

    if (!currentSession) {
      throw new Error('Session not found');
    }

    const newExpiry = new Date(currentSession.expiresAt.getTime() + (hoursToAdd * 60 * 60 * 1000));
    
    return this.updateExpiry(id, newExpiry);
  }

  /**
   * Delete session
   */
  async delete(id: string): Promise<void> {
    await this.prisma.cartSession.delete({
      where: { id }
    });
  }

  /**
   * Delete session by token
   */
  async deleteByToken(sessionToken: string): Promise<void> {
    await this.prisma.cartSession.delete({
      where: { sessionToken }
    });
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.prisma.cartSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });

    return result.count;
  }

  /**
   * Check if session is valid
   */
  async isValidSession(sessionToken: string): Promise<boolean> {
    const session = await this.findByToken(sessionToken);
    return session ? session.expiresAt > new Date() : false;
  }

  /**
   * Get session context
   */
  async getSessionContext(sessionToken: string): Promise<SessionContext | null> {
    const session = await this.findByToken(sessionToken);
    
    if (!session || session.expiresAt <= new Date()) {
      return null;
    }

    return {
      sessionId: session.id,
      userId: session.userId || undefined,
      isGuest: !session.userId,
      expiresAt: session.expiresAt
    };
  }

  /**
   * Associate session with user (for guest to user conversion)
   */
  async associateWithUser(sessionToken: string, userId: string): Promise<CartSession> {
    const session = await this.prisma.cartSession.update({
      where: { sessionToken },
      data: {
        userId,
        updatedAt: new Date()
      }
    });

    return this.mapPrismaSessionToCartSession(session);
  }

  /**
   * Generate unique session token
   */
  generateSessionToken(): string {
    return `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate session expiry date
   */
  calculateExpiryDate(hoursFromNow: number = 24): Date {
    return new Date(Date.now() + (hoursFromNow * 60 * 60 * 1000));
  }

  /**
   * Map Prisma CartSession to our CartSession type
   */
  private mapPrismaSessionToCartSession(prismaSession: any): CartSession {
    return {
      id: prismaSession.id,
      userId: prismaSession.userId || undefined,
      sessionToken: prismaSession.sessionToken,
      expiresAt: prismaSession.expiresAt,
      createdAt: prismaSession.createdAt,
      updatedAt: prismaSession.updatedAt
    };
  }
}
