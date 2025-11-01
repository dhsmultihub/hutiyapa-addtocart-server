import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, Inject, forwardRef } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
    WebSocketMessage,
    WebSocketConnection,
    WebSocketEventType,
    WebSocketRoom
} from '../types/events.types';
import { CartEventsService } from './cart-events.service';
import { v4 as uuidv4 } from 'uuid';

@WebSocketGateway({
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true
    },
    namespace: '/cart'
})
export class CartWebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(CartWebSocketGateway.name);
    private connections = new Map<string, WebSocketConnection>();
    private rooms = new Map<string, WebSocketRoom>();

    constructor(
        @Inject(forwardRef(() => CartEventsService))
        private readonly cartEventsService: CartEventsService
    ) { }

    afterInit(server: Server) {
        this.logger.log('WebSocket Gateway initialized');
    }

    async handleConnection(client: Socket) {
        try {
            this.logger.log(`Client connected: ${client.id}`);

            // Extract user information from connection
            const userId = client.handshake.auth?.userId;
            const sessionId = client.handshake.auth?.sessionId;
            const deviceId = client.handshake.auth?.deviceId;

            // Create connection record
            const connection: WebSocketConnection = {
                id: client.id,
                userId,
                sessionId,
                deviceId,
                rooms: [],
                connectedAt: new Date(),
                lastActivity: new Date(),
                metadata: {
                    userAgent: client.handshake.headers['user-agent'],
                    ipAddress: client.handshake.address,
                    connectedAt: new Date()
                }
            };

            this.connections.set(client.id, connection);

            // Send welcome message
            this.sendToClient(client, {
                type: WebSocketEventType.CONNECT,
                data: {
                    message: 'Connected to cart service',
                    connectionId: client.id,
                    timestamp: new Date()
                },
                timestamp: new Date()
            });

            this.logger.log(`Connection established: ${client.id} (User: ${userId || 'anonymous'})`);

        } catch (error) {
            this.logger.error('Connection handling failed:', error.message);
            client.disconnect();
        }
    }

    async handleDisconnect(client: Socket) {
        try {
            this.logger.log(`Client disconnected: ${client.id}`);

            const connection = this.connections.get(client.id);
            if (connection) {
                // Leave all rooms
                for (const room of connection.rooms) {
                    await this.handleLeaveRoom(client, { room });
                }

                // Remove connection
                this.connections.delete(client.id);

                this.logger.log(`Connection cleaned up: ${client.id}`);
            }

        } catch (error) {
            this.logger.error('Disconnect handling failed:', error.message);
        }
    }

    @SubscribeMessage('join_room')
    async handleJoinRoom(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { room: string }
    ) {
        try {
            const connection = this.connections.get(client.id);
            if (!connection) {
                throw new Error('Connection not found');
            }

            const room = data.room;

            // Join the room
            await client.join(room);

            // Add room to connection
            if (!connection.rooms.includes(room)) {
                connection.rooms.push(room);
            }

            // Create or update room record
            await this.createOrUpdateRoom(room, connection);

            // Send confirmation
            this.sendToClient(client, {
                type: WebSocketEventType.JOIN_ROOM,
                room,
                data: {
                    message: `Joined room: ${room}`,
                    room,
                    timestamp: new Date()
                },
                timestamp: new Date()
            });

            this.logger.log(`Client ${client.id} joined room: ${room}`);

        } catch (error) {
            this.logger.error('Join room failed:', error.message);
            this.sendToClient(client, {
                type: WebSocketEventType.ERROR,
                data: {
                    message: `Failed to join room: ${error.message}`,
                    error: error.message
                },
                timestamp: new Date()
            });
        }
    }

    @SubscribeMessage('leave_room')
    async handleLeaveRoom(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { room: string }
    ) {
        try {
            const connection = this.connections.get(client.id);
            if (!connection) {
                throw new Error('Connection not found');
            }

            const room = data.room;

            // Leave the room
            await client.leave(room);

            // Remove room from connection
            const roomIndex = connection.rooms.indexOf(room);
            if (roomIndex > -1) {
                connection.rooms.splice(roomIndex, 1);
            }

            // Update room record
            await this.updateRoomMembers(room, connection);

            // Send confirmation
            this.sendToClient(client, {
                type: WebSocketEventType.LEAVE_ROOM,
                room,
                data: {
                    message: `Left room: ${room}`,
                    room,
                    timestamp: new Date()
                },
                timestamp: new Date()
            });

            this.logger.log(`Client ${client.id} left room: ${room}`);

        } catch (error) {
            this.logger.error('Leave room failed:', error.message);
            this.sendToClient(client, {
                type: WebSocketEventType.ERROR,
                data: {
                    message: `Failed to leave room: ${error.message}`,
                    error: error.message
                },
                timestamp: new Date()
            });
        }
    }

    @SubscribeMessage('ping')
    async handlePing(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: any
    ) {
        try {
            const connection = this.connections.get(client.id);
            if (connection) {
                connection.lastActivity = new Date();
            }

            // Send pong response
            this.sendToClient(client, {
                type: WebSocketEventType.PONG,
                data: {
                    message: 'pong',
                    timestamp: new Date()
                },
                timestamp: new Date()
            });

        } catch (error) {
            this.logger.error('Ping handling failed:', error.message);
        }
    }

    @SubscribeMessage('cart_update')
    async handleCartUpdate(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: any
    ) {
        try {
            const connection = this.connections.get(client.id);
            if (!connection) {
                throw new Error('Connection not found');
            }

            // Update last activity
            connection.lastActivity = new Date();

            // Process cart update
            await this.cartEventsService.handleCartUpdate(connection, data);

            this.logger.log(`Cart update processed for client: ${client.id}`);

        } catch (error) {
            this.logger.error('Cart update handling failed:', error.message);
            this.sendToClient(client, {
                type: WebSocketEventType.ERROR,
                data: {
                    message: `Cart update failed: ${error.message}`,
                    error: error.message
                },
                timestamp: new Date()
            });
        }
    }

    /**
     * Send message to specific client
     */
    sendToClient(client: Socket, message: WebSocketMessage): void {
        try {
            client.emit(message.type, message);
        } catch (error) {
            this.logger.error('Failed to send message to client:', error.message);
        }
    }

    /**
     * Send message to room
     */
    sendToRoom(room: string, message: WebSocketMessage): void {
        try {
            this.server.to(room).emit(message.type, message);
        } catch (error) {
            this.logger.error(`Failed to send message to room ${room}:`, error.message);
        }
    }

    /**
     * Send message to user
     */
    sendToUser(userId: string, message: WebSocketMessage): void {
        try {
            const userConnections = Array.from(this.connections.values())
                .filter(conn => conn.userId === userId);

            for (const connection of userConnections) {
                const client = this.server.sockets.sockets.get(connection.id);
                if (client) {
                    this.sendToClient(client, message);
                }
            }
        } catch (error) {
            this.logger.error(`Failed to send message to user ${userId}:`, error.message);
        }
    }

    /**
     * Send message to session
     */
    sendToSession(sessionId: string, message: WebSocketMessage): void {
        try {
            const sessionConnections = Array.from(this.connections.values())
                .filter(conn => conn.sessionId === sessionId);

            for (const connection of sessionConnections) {
                const client = this.server.sockets.sockets.get(connection.id);
                if (client) {
                    this.sendToClient(client, message);
                }
            }
        } catch (error) {
            this.logger.error(`Failed to send message to session ${sessionId}:`, error.message);
        }
    }

    /**
     * Broadcast message to all connected clients
     */
    broadcast(message: WebSocketMessage): void {
        try {
            this.server.emit(message.type, message);
        } catch (error) {
            this.logger.error('Failed to broadcast message:', error.message);
        }
    }

    /**
     * Get connection by ID
     */
    getConnection(connectionId: string): WebSocketConnection | undefined {
        return this.connections.get(connectionId);
    }

    /**
     * Get connections by user ID
     */
    getConnectionsByUser(userId: string): WebSocketConnection[] {
        return Array.from(this.connections.values())
            .filter(conn => conn.userId === userId);
    }

    /**
     * Get connections by session ID
     */
    getConnectionsBySession(sessionId: string): WebSocketConnection[] {
        return Array.from(this.connections.values())
            .filter(conn => conn.sessionId === sessionId);
    }

    /**
     * Get room members
     */
    getRoomMembers(room: string): WebSocketConnection[] {
        return Array.from(this.connections.values())
            .filter(conn => conn.rooms.includes(room));
    }

    /**
     * Get connection statistics
     */
    getConnectionStats(): any {
        const connections = Array.from(this.connections.values());

        return {
            totalConnections: connections.length,
            activeConnections: connections.filter(conn =>
                Date.now() - conn.lastActivity.getTime() < 5 * 60 * 1000 // 5 minutes
            ).length,
            byUser: this.groupBy(connections, 'userId'),
            bySession: this.groupBy(connections, 'sessionId'),
            byDevice: this.groupBy(connections, 'deviceId'),
            averageConnectionDuration: this.calculateAverageConnectionDuration(connections)
        };
    }

    /**
     * Create or update room
     */
    private async createOrUpdateRoom(roomName: string, connection: WebSocketConnection): Promise<void> {
        try {
            let room = this.rooms.get(roomName);

            if (!room) {
                room = {
                    id: uuidv4(),
                    name: roomName,
                    type: this.determineRoomType(roomName),
                    members: [],
                    createdAt: new Date(),
                    metadata: {}
                };
                this.rooms.set(roomName, room);
            }

            // Add member if not already present
            if (!room.members.includes(connection.id)) {
                room.members.push(connection.id);
            }
        } catch (error) {
            this.logger.error('Room creation/update failed:', error.message);
        }
    }

    /**
     * Update room members
     */
    private async updateRoomMembers(roomName: string, connection: WebSocketConnection): Promise<void> {
        try {
            const room = this.rooms.get(roomName);
            if (room) {
                const memberIndex = room.members.indexOf(connection.id);
                if (memberIndex > -1) {
                    room.members.splice(memberIndex, 1);
                }

                // Remove room if no members
                if (room.members.length === 0) {
                    this.rooms.delete(roomName);
                }
            }
        } catch (error) {
            this.logger.error('Room members update failed:', error.message);
        }
    }

    /**
     * Determine room type based on room name
     */
    private determineRoomType(roomName: string): 'user' | 'session' | 'cart' | 'product' | 'order' {
        if (roomName.startsWith('user:')) return 'user';
        if (roomName.startsWith('session:')) return 'session';
        if (roomName.startsWith('cart:')) return 'cart';
        if (roomName.startsWith('product:')) return 'product';
        if (roomName.startsWith('order:')) return 'order';
        return 'user'; // default
    }

    /**
     * Group connections by field
     */
    private groupBy(connections: WebSocketConnection[], field: keyof WebSocketConnection): Record<string, number> {
        return connections.reduce((acc, conn) => {
            const value = conn[field] as string;
            if (value) {
                acc[value] = (acc[value] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);
    }

    /**
     * Calculate average connection duration
     */
    private calculateAverageConnectionDuration(connections: WebSocketConnection[]): number {
        if (connections.length === 0) return 0;

        const now = new Date();
        const totalDuration = connections.reduce((sum, conn) => {
            return sum + (now.getTime() - conn.connectedAt.getTime());
        }, 0);

        return totalDuration / connections.length;
    }
}
