# Multi-stage Dockerfile for sample-app
# Stage 1: Dependencies (cached layer)
FROM node:22 AS deps
WORKDIR /workspace
# Copy only package files for dependency caching
COPY package.json yarn.lock ./
# Copy all package.json files in packages
COPY packages packages
# Copy sample-app package.json
COPY examples/sample-app/package.json examples/sample-app/
# Enable corepack and install dependencies
RUN corepack enable && yarn install --frozen-lockfile

# Stage 2: Build (cached layer)
FROM node:22 AS build
WORKDIR /workspace
# Copy dependencies from previous stage
COPY --from=deps /workspace/node_modules ./node_modules
# Copy all source code
COPY . .
# Build all packages and sample-app
RUN corepack enable && \
    yarn build:all && \
    yarn workspace sample-app build

# Stage 3: Runtime
FROM node:22 AS runtime
WORKDIR /workspace
# Copy built artifacts and node_modules
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/packages packages
COPY --from=build /workspace/examples/sample-app examples/sample-app
COPY --from=build /workspace/package.json ./
# Set working directory to sample-app
WORKDIR /workspace/examples/sample-app
# Expose port
EXPOSE 3000
# Start app
CMD ["node", "dist/main.js"]

