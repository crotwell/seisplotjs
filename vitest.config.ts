import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: "happy-dom",
    setupFiles: ['./test_setup.js'],
    tags: [
      {
        name: 'remotes',
        description: 'Tests that query remote servers, use with caution.',
      },
    ],
  },
})
