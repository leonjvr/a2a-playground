#!/usr/bin/env node

const { exec, spawn } = require('child_process');
const path = require('path');
const net = require('net');

/**
 * Simple script to install dependencies and run the A2A demo
 */

console.log('🚀 A2A Playground Setup and Demo Runner\n');

// Check if port is available
function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close();
      resolve(true);
    });
    server.on('error', () => {
      resolve(false);
    });
  });
}

// Kill process on specific port
function killProcessOnPort(port) {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
        if (error || !stdout) {
          resolve(false);
          return;
        }
        
        const lines = stdout.trim().split('\n');
        const pids = lines
          .filter(line => line.includes('LISTENING'))
          .map(line => line.trim().split(/\s+/).pop())
          .filter(pid => pid !== '0');
        
        if (pids.length === 0) {
          resolve(false);
          return;
        }
        
        let killed = 0;
        pids.forEach(pid => {
          exec(`taskkill /PID ${pid} /F`, (killError) => {
            killed++;
            if (killed === pids.length) {
              resolve(true);
            }
          });
        });
      });
    } else {
      // For Unix-like systems
      exec(`lsof -ti:${port}`, (error, stdout) => {
        if (error || !stdout) {
          resolve(false);
          return;
        }
        
        const pid = stdout.trim();
        exec(`kill -9 ${pid}`, (killError) => {
          resolve(!killError);
        });
      });
    }
  });
}

// Check if node_modules exists
const fs = require('fs');
const nodeModulesPath = path.join(__dirname, 'node_modules');

async function setup() {
  if (!fs.existsSync(nodeModulesPath)) {
    console.log('📦 Installing dependencies...');
    
    await new Promise((resolve, reject) => {
      exec('npm install', (error, stdout, stderr) => {
        if (error) {
          console.error('❌ Failed to install dependencies:', error);
          reject(error);
        } else {
          console.log('✓ Dependencies installed successfully\n');
          resolve();
        }
      });
    });
  } else {
    console.log('✓ Dependencies already installed\n');
  }
}

async function runDemo() {
  console.log('Select a demo to run:');
  console.log('1. Comprehensive Demo (showcases all features)');
  console.log('2. Basic Client Demo');
  console.log('3. Streaming Client Demo');
  console.log('4. Push Notification Demo');
  console.log('5. Multi-Agent Collaboration');
  console.log('6. Batch Processing Pipeline');
  console.log('7. Human-in-the-Loop Workflow');
  console.log('8. Run Tests');
  console.log('9. Start Server Only');
  console.log();
  
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('Enter your choice (1-9): ', async (choice) => {
    rl.close();
    
    let serverProcess;
    let clientProcess;
    const serverPort = 3100;
    
    // Check if port is already in use
    const portAvailable = await checkPort(serverPort);
    
    if (!portAvailable) {
      console.log(`\n⚠️  Port ${serverPort} is already in use.`);
      console.log('Attempting to free the port...');
      
      const killed = await killProcessOnPort(serverPort);
      if (killed) {
        console.log(`✓ Port ${serverPort} freed successfully`);
        // Wait a moment for the port to be fully released
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.error(`❌ Failed to free port ${serverPort}. Please manually stop any processes using this port.`);
        process.exit(1);
      }
    }
    
    // Start server in the background for most demos
    if (choice !== '9') {
      console.log(`\n📡 Starting A2A server on port ${serverPort}...`);
      serverProcess = spawn('node', ['server/server.js'], { 
        stdio: 'pipe',
        env: { ...process.env, PORT: serverPort }
      });
      
      let serverReady = false;
      let serverOutput = '';
      
      serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        serverOutput += output;
        if (output.includes('A2A Demo Server running')) {
          serverReady = true;
          console.log('✓ Server is running\n');
          runClientDemo();
        }
      });
      
      serverProcess.stderr.on('data', (data) => {
        console.error('Server error:', data.toString());
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (!serverReady) {
          console.error('❌ Server failed to start within 10 seconds');
          console.error('Server output:', serverOutput);
          process.exit(1);
        }
      }, 10000);
    } else {
      // Just start the server
      const server = spawn('node', ['server/server.js'], { 
        stdio: 'inherit',
        env: { ...process.env, PORT: serverPort }
      });
      
      process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down server...');
        server.kill();
        process.exit(0);
      });
    }
    
    function runClientDemo() {
      let demoScript;
      
      switch (choice) {
        case '1':
          demoScript = ['examples/comprehensive-demo.js'];
          break;
        case '2':
          demoScript = ['client/client.js'];
          break;
        case '3':
          demoScript = ['client/client-stream.js'];
          break;
        case '4':
          demoScript = ['client/client-push.js'];
          break;
        case '5':
          demoScript = ['examples/scenarios/multi-agent-collaboration.js'];
          break;
        case '6':
          demoScript = ['examples/scenarios/batch-processing.js'];
          break;
        case '7':
          demoScript = ['examples/scenarios/human-in-the-loop.js'];
          break;
        case '8':
          demoScript = ['tests/test-all.js'];
          break;
        default:
          console.log('Invalid choice. Running comprehensive demo...');
          demoScript = ['examples/comprehensive-demo.js'];
      }
      
      if (choice !== '9') {
        console.log(`🎬 Starting demo: ${demoScript[0]}\n`);
        
        clientProcess = spawn('node', demoScript, { stdio: 'inherit' });
        
        clientProcess.on('close', (code) => {
          console.log(`\n✓ Demo completed with code ${code}`);
          
          // Clean shutdown
          if (serverProcess) {
            console.log('\n🛑 Shutting down server...');
            serverProcess.kill();
          }
          
          console.log('\nThank you for using A2A Playground! 👋');
          process.exit(code);
        });
      }
    }
    
    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Shutting down...');
      
      if (clientProcess) {
        clientProcess.kill();
      }
      
      if (serverProcess) {
        serverProcess.kill();
      }
      
      process.exit(0);
    });
  });
}

// Main execution
async function main() {
  try {
    await setup();
    await runDemo();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}
