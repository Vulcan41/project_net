import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    define: {
      __API_URL__: JSON.stringify(env.VITE_API_URL || '')
    },
    resolve: {
      alias: {
        '@core': resolve(__dirname, 'src/core'),
        '@components': resolve(__dirname, 'src/shared/components'),
        '@services': resolve(__dirname, 'src/shared/services'),
        '@state': resolve(__dirname, 'src/shared/state'),
        '@features': resolve(__dirname, 'src/features'),
        '@assets': resolve(__dirname, 'assets'),
        '@locales': resolve(__dirname, 'src/locales'),
        '@shared': resolve(__dirname, 'src/shared'),
        '@app': resolve(__dirname, 'src/app'),
      }
    },
    build: {
      outDir: 'dist'
    }
  }
})
