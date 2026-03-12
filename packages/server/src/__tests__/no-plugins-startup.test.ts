/**
 * No-plugins startup test.
 *
 * Verifies that the core can boot without any plugins present.
 * This is the acceptance test for the decoupling goal:
 * "删掉 src/plugins 后核心依然能活"
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HookRegistry } from '../core/plugin-system/hook-registry.js';
import { ServiceRegistry } from '../core/plugin-system/service-registry.js';
import { PluginDiscovery } from '../core/plugin-system/discovery.js';
import { PluginLoader } from '../core/plugin-system/loader.js';
import { registerCityCommands } from '../core/city/commands.js';

// Suppress console output during tests
beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => { });
    vi.spyOn(console, 'warn').mockImplementation(() => { });
    vi.spyOn(console, 'error').mockImplementation(() => { });
});

describe('No-plugins startup', () => {

    it('should boot core services without any plugins directory', async () => {
        const hooks = new HookRegistry();
        const services = new ServiceRegistry();

        // Discovery with a non-existent plugins path — should not throw
        // Discovery with non-existent rootDir — default paths resolve to nowhere
        const discovery = new PluginDiscovery('./non-existent-config.json', '/tmp/no-plugins-test-root');
        const loader = new PluginLoader(discovery);

        // Register core routes (no plugins involved)
        registerCityCommands(hooks);

        // Discover plugins — should return empty, not throw
        await discovery.loadConfig();
        const discovered = await discovery.discoverPlugins();
        expect(discovered.size).toBe(0);

        // discoverAndRegisterAll — should succeed with 0 plugins
        const loaded = await loader.discoverAndRegisterAll();
        expect(loaded).toEqual([]);

        // Core WS commands should be registered
        const commands = hooks.listWSCommands();
        expect(commands).toContain('enter_city');
        expect(commands).toContain('leave_city');
        expect(commands).toContain('enter_location');
        expect(commands).toContain('leave_location');
        expect(commands).toContain('what_location');
        expect(commands).toContain('what_commands');

        // Schemas should be available without duplicates
        const schemas = hooks.getWSCommandSchemas();
        const typeNames = schemas.map(s => s.type);
        const uniqueTypes = [...new Set(typeNames)];
        expect(typeNames.length).toBe(uniqueTypes.length); // no duplicates
    });

    it('should handle missing plugins.json gracefully', async () => {
        const discovery = new PluginDiscovery('./non-existent-config.json');

        // loadConfig should not throw when config file is missing
        await discovery.loadConfig();

        // isEnabled should default to true for unknown plugins
        expect(discovery.isEnabled('any-plugin')).toBe(true);

        // shouldAutoLoad should default to true
        expect(discovery.shouldAutoLoad('any-plugin')).toBe(true);
    });

    it('seed.ts should not import any plugin code', async () => {
        // Dynamically import seed to verify it doesn't pull in plugin deps
        const seed = await import('../seed.js');
        expect(seed.seedAdmin).toBeDefined();
        // seedTriviaQuestions should NOT exist on core seed
        expect((seed as any).seedTriviaQuestions).toBeUndefined();
    }, 15000);

    it('core command schemas should have no duplicates', () => {
        const hooks = new HookRegistry();
        registerCityCommands(hooks);

        const schemas = hooks.getWSCommandSchemas();
        const types = schemas.map(s => s.type);
        const unique = [...new Set(types)];

        expect(types).toEqual(unique);
        // Each city command should appear exactly once
        expect(types.filter(t => t === 'enter_city').length).toBe(1);
        expect(types.filter(t => t === 'what_location').length).toBe(1);
        expect(types.filter(t => t === 'what_commands').length).toBe(1);
    });
});
