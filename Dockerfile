
FROM node:20-bookworm-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy application source
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 5173

# Start command (using preview to serve the built app)
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
