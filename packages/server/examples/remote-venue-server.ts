/**
 * Example Remote Venue Server
 *
 * This is a reference implementation of a remote venue server that implements
 * the Remote Venue Protocol. It can be used as a starting point for creating
 * your own remote venue implementations.
 *
 * To run this server:
 * 1. npm install express
 * 2. ts-node examples/remote-venue-server.ts
 * 3. Configure RemoteVenueProxy to point to http://localhost:3001
 */

import express, { Request, Response } from 'express';

// Types
interface AgentSession {
  id: string;
  name: string;
  metadata?: Record<string, any>;
}

interface Action {
  type: string;
  params?: Record<string, any>;
}

interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

interface ActionSchema {
  type: string;
  description: string;
  params: Record<string, any>;
}

// Simple in-memory game state
class SimplePokerVenue {
  private players: Map<string, { balance: number; bet: number }> = new Map();
  private pot: number = 0;
  private isLoaded: boolean = false;

  onLoad(): void {
    console.log('Venue loaded');
    this.isLoaded = true;
  }

  onUnload(): void {
    console.log('Venue unloaded');
    this.isLoaded = false;
    this.players.clear();
    this.pot = 0;
  }

  onPlayerJoin(agent: AgentSession): void {
    console.log(`Player joined: ${agent.name} (${agent.id})`);
    if (!this.players.has(agent.id)) {
      this.players.set(agent.id, { balance: 1000, bet: 0 });
    }
  }

  onPlayerLeave(agent: AgentSession): void {
    console.log(`Player left: ${agent.name} (${agent.id})`);
    this.players.delete(agent.id);
  }

  onAction(agent: AgentSession, action: Action): ActionResult {
    console.log(`Action from ${agent.name}: ${action.type}`, action.params);

    const player = this.players.get(agent.id);
    if (!player) {
      return {
        success: false,
        error: 'Player not found. Please join the venue first.',
      };
    }

    switch (action.type) {
      case 'bet':
        return this.handleBet(agent.id, player, action.params?.amount);

      case 'fold':
        return this.handleFold(agent.id, player);

      case 'check':
        return this.handleCheck(agent.id, player);

      case 'getBalance':
        return {
          success: true,
          data: {
            balance: player.balance,
            bet: player.bet,
            pot: this.pot,
          },
        };

      default:
        return {
          success: false,
          error: `Unknown action type: ${action.type}`,
        };
    }
  }

  private handleBet(playerId: string, player: { balance: number; bet: number }, amount?: number): ActionResult {
    if (typeof amount !== 'number' || amount <= 0) {
      return {
        success: false,
        error: 'Invalid bet amount',
      };
    }

    if (amount > player.balance) {
      return {
        success: false,
        error: 'Insufficient balance',
      };
    }

    player.balance -= amount;
    player.bet += amount;
    this.pot += amount;

    return {
      success: true,
      data: {
        message: `Bet ${amount} chips`,
        newBalance: player.balance,
        currentBet: player.bet,
        pot: this.pot,
      },
    };
  }

  private handleFold(playerId: string, player: { balance: number; bet: number }): ActionResult {
    player.bet = 0;
    return {
      success: true,
      data: {
        message: 'Folded',
        balance: player.balance,
      },
    };
  }

  private handleCheck(playerId: string, player: { balance: number; bet: number }): ActionResult {
    return {
      success: true,
      data: {
        message: 'Checked',
        balance: player.balance,
        currentBet: player.bet,
      },
    };
  }

  getActionSchema(): ActionSchema[] {
    return [
      {
        type: 'bet',
        description: 'Place a bet',
        params: {
          amount: {
            type: 'number',
            required: true,
            min: 1,
            max: 1000,
            description: 'Amount to bet',
          },
        },
      },
      {
        type: 'fold',
        description: 'Fold your hand',
        params: {},
      },
      {
        type: 'check',
        description: 'Check (pass without betting)',
        params: {},
      },
      {
        type: 'getBalance',
        description: 'Get current balance and pot',
        params: {},
      },
    ];
  }
}

// Create Express app
const app = express();
const venue = new SimplePokerVenue();

// Middleware
app.use(express.json());

// Optional: API Key authentication
const API_KEY = process.env.API_KEY || 'test-api-key';

function authenticateApiKey(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Missing or invalid Authorization header',
    });
  }

  const token = authHeader.substring(7);
  if (token !== API_KEY) {
    return res.status(401).json({
      success: false,
      error: 'Invalid API key',
    });
  }

  next();
}

// Apply authentication to all routes (comment out for testing without auth)
// app.use(authenticateApiKey);

// Lifecycle endpoints
app.post('/lifecycle/load', (req: Request, res: Response) => {
  try {
    venue.onLoad();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post('/lifecycle/unload', (req: Request, res: Response) => {
  try {
    venue.onUnload();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Player management endpoints
app.post('/player/join', (req: Request, res: Response) => {
  try {
    const { agent } = req.body;
    if (!agent || !agent.id) {
      return res.status(400).json({
        success: false,
        error: 'Invalid agent data',
      });
    }
    venue.onPlayerJoin(agent);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post('/player/leave', (req: Request, res: Response) => {
  try {
    const { agent } = req.body;
    if (!agent || !agent.id) {
      return res.status(400).json({
        success: false,
        error: 'Invalid agent data',
      });
    }
    venue.onPlayerLeave(agent);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Action endpoint
app.post('/action', (req: Request, res: Response) => {
  try {
    const { agent, action } = req.body;
    if (!agent || !agent.id || !action || !action.type) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
      });
    }
    const result = venue.onAction(agent, action);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Schema endpoint
app.get('/schema', (req: Request, res: Response) => {
  try {
    const schema = venue.getActionSchema();
    res.json(schema);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Remote Venue Server running on port ${PORT}`);
  console.log(`API Key: ${API_KEY}`);
  console.log('\nEndpoints:');
  console.log(`  POST http://localhost:${PORT}/lifecycle/load`);
  console.log(`  POST http://localhost:${PORT}/lifecycle/unload`);
  console.log(`  POST http://localhost:${PORT}/player/join`);
  console.log(`  POST http://localhost:${PORT}/player/leave`);
  console.log(`  POST http://localhost:${PORT}/action`);
  console.log(`  GET  http://localhost:${PORT}/schema`);
  console.log(`  GET  http://localhost:${PORT}/health`);
});
