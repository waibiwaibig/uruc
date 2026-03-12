import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PluginDiscovery, getDefaultPluginConfigFilename } from '../discovery.js';
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const TEST_ROOT = path.join(process.cwd(), 'test-plugins-temp');
const TEST_CONFIG = path.join(TEST_ROOT, 'plugins.dev.json');

describe('PluginDiscovery', () => {
  let discovery: PluginDiscovery;
  const previousPluginRuntime = process.env.URUC_PLUGIN_RUNTIME;

  beforeEach(async () => {
    await fs.mkdir(TEST_ROOT, { recursive: true });
    await fs.mkdir(path.join(TEST_ROOT, 'src/plugins'), { recursive: true });
    await fs.mkdir(path.join(TEST_ROOT, 'dist/plugins'), { recursive: true });

    const config = {
      plugins: {
        'test-plugin': { enabled: true, autoLoad: true },
        'disabled-plugin': { enabled: false, autoLoad: false },
        'stale-plugin': { enabled: true, autoLoad: true },
      },
      discovery: {
        enabled: true,
        paths: ['./src/plugins'],
        exclude: ['__tests__', 'node_modules'],
      },
    };
    await fs.writeFile(TEST_CONFIG, JSON.stringify(config, null, 2));

    discovery = new PluginDiscovery(TEST_CONFIG, TEST_ROOT);
  });

  afterEach(async () => {
    if (previousPluginRuntime === undefined) {
      delete process.env.URUC_PLUGIN_RUNTIME;
    } else {
      process.env.URUC_PLUGIN_RUNTIME = previousPluginRuntime;
    }
    if (existsSync(TEST_ROOT)) {
      await fs.rm(TEST_ROOT, { recursive: true, force: true });
    }
  });

  describe('defaults', () => {
    it('should resolve default config filename from NODE_ENV', () => {
      expect(getDefaultPluginConfigFilename('development')).toBe('plugins.dev.json');
      expect(getDefaultPluginConfigFilename('production')).toBe('plugins.prod.json');
    });
  });

  describe('loadConfig', () => {
    it('should load configuration from file', async () => {
      await discovery.loadConfig();

      expect(discovery.isEnabled('test-plugin')).toBe(true);
      expect(discovery.isEnabled('disabled-plugin')).toBe(false);
      expect(discovery.shouldAutoLoad('test-plugin')).toBe(true);
    });

    it('should handle missing config file gracefully', async () => {
      const nonExistentConfig = path.join(TEST_ROOT, 'nonexistent.json');
      const discovery2 = new PluginDiscovery(nonExistentConfig, TEST_ROOT);

      await expect(discovery2.loadConfig()).resolves.not.toThrow();
    });
  });

  describe('saveConfig', () => {
    it('should save configuration to file', async () => {
      await discovery.loadConfig();
      await discovery.setEnabled('test-plugin', false);

      const content = await fs.readFile(TEST_CONFIG, 'utf-8');
      const config = JSON.parse(content);

      expect(config.plugins['test-plugin'].enabled).toBe(false);
    });
  });

  describe('discoverPlugins', () => {
    it('should discover plugins with plugin.json', async () => {
      await discovery.loadConfig();

      const pluginDir = path.join(TEST_ROOT, 'src/plugins/my-plugin');
      await fs.mkdir(pluginDir, { recursive: true });
      await fs.writeFile(
        path.join(pluginDir, 'plugin.json'),
        JSON.stringify({
          name: 'my-plugin',
          version: '1.0.0',
          description: 'Test plugin',
          main: 'index.ts',
          dependencies: [],
        }),
      );

      const discovered = await discovery.discoverPlugins();

      expect(discovered.has('my-plugin')).toBe(true);
      expect(discovered.get('my-plugin')?.version).toBe('1.0.0');
    });

    it('should discover from dist path when config points to dist/plugins', async () => {
      const prodConfigPath = path.join(TEST_ROOT, 'plugins.prod.json');
      await fs.writeFile(prodConfigPath, JSON.stringify({
        plugins: {},
        discovery: {
          enabled: true,
          paths: ['./dist/plugins'],
          exclude: ['__tests__', 'node_modules'],
        },
      }, null, 2));

      const prodDiscovery = new PluginDiscovery(prodConfigPath, TEST_ROOT);
      await prodDiscovery.loadConfig();

      const pluginDir = path.join(TEST_ROOT, 'dist/plugins/prod-plugin');
      await fs.mkdir(pluginDir, { recursive: true });
      await fs.writeFile(path.join(pluginDir, 'plugin.json'), JSON.stringify({
        name: 'prod-plugin',
        version: '1.2.3',
        main: 'index.js',
      }));

      const discovered = await prodDiscovery.discoverPlugins();
      expect(discovered.has('prod-plugin')).toBe(true);
    });

    it('should prefer dist/plugins at runtime when config still points to src/plugins', async () => {
      process.env.URUC_PLUGIN_RUNTIME = 'dist';
      await discovery.loadConfig();

      const pluginDir = path.join(TEST_ROOT, 'dist/plugins/runtime-plugin');
      await fs.mkdir(pluginDir, { recursive: true });
      await fs.writeFile(path.join(pluginDir, 'plugin.json'), JSON.stringify({
        name: 'runtime-plugin',
        version: '9.9.9',
        main: 'index.js',
      }));

      const discovered = await discovery.discoverPlugins();
      expect(discovered.has('runtime-plugin')).toBe(true);
    });

    it('should exclude directories in exclude list', async () => {
      await discovery.loadConfig();

      const excludedDir = path.join(TEST_ROOT, 'src/plugins/__tests__');
      await fs.mkdir(excludedDir, { recursive: true });
      await fs.writeFile(
        path.join(excludedDir, 'plugin.json'),
        JSON.stringify({ name: 'test-plugin', version: '1.0.0', main: 'index.ts' }),
      );

      const discovered = await discovery.discoverPlugins();

      expect(discovered.has('test-plugin')).toBe(false);
    });
  });

  describe('stale config entries', () => {
    it('should report stale configured plugins without mutating config', async () => {
      await discovery.loadConfig();

      const pluginDir = path.join(TEST_ROOT, 'src/plugins/test-plugin');
      await fs.mkdir(pluginDir, { recursive: true });
      await fs.writeFile(path.join(pluginDir, 'plugin.json'), JSON.stringify({
        name: 'test-plugin',
        version: '1.0.0',
        main: 'index.ts',
      }));

      const discovered = await discovery.discoverPlugins();
      const stale = discovery.getStaleConfiguredPlugins(discovered);

      expect(stale).toContain('stale-plugin');
      expect(stale).not.toContain('test-plugin');
    });
  });

  describe('setEnabled', () => {
    it('should enable a plugin', async () => {
      await discovery.loadConfig();
      await discovery.setEnabled('disabled-plugin', true);

      expect(discovery.isEnabled('disabled-plugin')).toBe(true);
    });

    it('should disable a plugin', async () => {
      await discovery.loadConfig();
      await discovery.setEnabled('test-plugin', false);

      expect(discovery.isEnabled('test-plugin')).toBe(false);
    });
  });

  describe('installPlugin', () => {
    it('should install a plugin from source directory', async () => {
      await discovery.loadConfig();

      const sourceDir = path.join(TEST_ROOT, 'source-plugin');
      await fs.mkdir(sourceDir, { recursive: true });
      await fs.writeFile(
        path.join(sourceDir, 'plugin.json'),
        JSON.stringify({
          name: 'new-plugin',
          version: '1.0.0',
          main: 'index.ts',
        }),
      );
      await fs.writeFile(path.join(sourceDir, 'index.ts'), 'export default {};');

      const targetPath = await discovery.installPlugin(sourceDir);

      expect(existsSync(targetPath)).toBe(true);
      expect(existsSync(path.join(targetPath, 'plugin.json'))).toBe(true);
      expect(discovery.isEnabled('new-plugin')).toBe(true);
    });

    it('should throw error if plugin.json is missing', async () => {
      await discovery.loadConfig();

      const sourceDir = path.join(TEST_ROOT, 'invalid-plugin');
      await fs.mkdir(sourceDir, { recursive: true });

      await expect(discovery.installPlugin(sourceDir)).rejects.toThrow('No plugin.json found');
    });
  });

  describe('uninstallPlugin', () => {
    it('should soft uninstall (disable) a plugin', async () => {
      await discovery.loadConfig();
      await discovery.uninstallPlugin('test-plugin', false);

      expect(discovery.isEnabled('test-plugin')).toBe(false);
    });

    it('should hard uninstall (delete) a plugin', async () => {
      await discovery.loadConfig();

      const pluginDir = path.join(TEST_ROOT, 'src/plugins/test-plugin');
      await fs.mkdir(pluginDir, { recursive: true });
      await fs.writeFile(path.join(pluginDir, 'index.ts'), 'export default {};');

      await discovery.uninstallPlugin('test-plugin', true);

      expect(existsSync(pluginDir)).toBe(false);
    });
  });
});
