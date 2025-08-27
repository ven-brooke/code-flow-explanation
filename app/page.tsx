"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Play, Pause, RotateCcw, ChevronRight, Server, Users, Download, Network } from "lucide-react"

interface SequenceStep {
  id: number
  phase: string
  actor1: string
  actor2: string
  message: string
  description: string
  code?: string
}

const sequenceSteps: SequenceStep[] = [
  {
    id: 1,
    phase: "Initialization",
    actor1: "Main Thread",
    actor2: "System",
    message: "find_available_port(9005-9009)",
    description: "Scans ports 9005-9009 to find an available port for this seeder instance",
    code: "int port = find_available_port(server_fd, address);",
  },
  {
    id: 2,
    phase: "Initialization",
    actor1: "Main Thread",
    actor2: "Server Thread",
    message: "pthread_create(server_thread)",
    description: "Spawns dedicated server thread to handle incoming client connections",
    code: "pthread_create(&tid, nullptr, server_thread, &server_fd);",
  },
  {
    id: 3,
    phase: "Server Startup",
    actor1: "Server Thread",
    actor2: "Network",
    message: "listen() on port",
    description: "Server thread begins listening for incoming TCP connections",
    code: "listen(server_fd, 10);",
  },
  {
    id: 4,
    phase: "Client Discovery",
    actor1: "Main Thread",
    actor2: "Network",
    message: "get_active_ports()",
    description: "Discovers other active seeders by testing connections to ports 9005-9009",
    code: "std::vector<int> active_ports = get_active_ports(port);",
  },
  {
    id: 5,
    phase: "File Discovery",
    actor1: "Main Thread",
    actor2: "Seeder (Port 9006)",
    message: "LIST_FILES request",
    description: "Requests file list from discovered seeder",
    code: 'send_all(sock, "LIST_FILES", 10);',
  },
  {
    id: 6,
    phase: "File Discovery",
    actor1: "Seeder (Port 9006)",
    actor2: "Client Handler",
    message: "accept() connection",
    description: "Server accepts connection and spawns handler thread",
    code: "int client_socket = accept(server_fd, ...);",
  },
  {
    id: 7,
    phase: "File Discovery",
    actor1: "Client Handler",
    actor2: "File System",
    message: "get_local_files()",
    description: "Scans local seed directory for available files",
    code: "std::vector<FileInfo> local_files = get_local_files(current_port);",
  },
  {
    id: 8,
    phase: "File Discovery",
    actor1: "Client Handler",
    actor2: "Main Thread",
    message: "file_list response",
    description: "Returns serialized file metadata: filepath|key_id|size|seed_info",
    code: "send_all(client_socket, response.c_str(), response.size());",
  },
  {
    id: 9,
    phase: "Download Initiation",
    actor1: "Main Thread",
    actor2: "Download Thread",
    message: "std::thread(download_files_background)",
    description: "Spawns background thread for parallel file downloading",
    code: "std::thread download_thread(download_files_background);",
  },
  {
    id: 10,
    phase: "Chunk Calculation",
    actor1: "Download Thread",
    actor2: "System",
    message: "calculate chunks (32-byte)",
    description: "Divides file into 32-byte chunks for parallel downloading",
    code: "size_t total_chunks = (file_size + CHUNK_SIZE - 1) / CHUNK_SIZE;",
  },
  {
    id: 11,
    phase: "Chunk Distribution",
    actor1: "Download Thread",
    actor2: "System",
    message: "round-robin port assignment",
    description: "Distributes chunks across available seeders using round-robin",
    code: "int target_port = valid_source_ports[i % valid_source_ports.size()];",
  },
  {
    id: 12,
    phase: "Parallel Download",
    actor1: "Download Thread",
    actor2: "Chunk Thread 1",
    message: "std::thread(download_chunk)",
    description: "Spawns thread to download chunk from specific seeder",
    code: "chunk_threads.emplace_back([&chunk]() { download_chunk_from_port(...); });",
  },
  {
    id: 13,
    phase: "Chunk Request",
    actor1: "Chunk Thread 1",
    actor2: "Seeder (Port 9007)",
    message: "DOWNLOAD_CHUNK|filepath|offset|size",
    description: "Requests specific chunk with byte offset and size",
    code: "send_all(sock, request.c_str(), request.size());",
  },
  {
    id: 14,
    phase: "Chunk Processing",
    actor1: "Seeder (Port 9007)",
    actor2: "File System",
    message: "file.seekg(offset)",
    description: "Seeks to specific byte offset in file",
    code: "file.seekg(start_offset); file.read(chunk_data, chunk_size);",
  },
  {
    id: 15,
    phase: "Chunk Response",
    actor1: "Seeder (Port 9007)",
    actor2: "Chunk Thread 1",
    message: "binary chunk data",
    description: "Returns raw 32-byte chunk data",
    code: "send_all(client_socket, chunk_data, bytes_read);",
  },
  {
    id: 16,
    phase: "Fault Tolerance",
    actor1: "Chunk Thread 1",
    actor2: "Seeder (Port 9008)",
    message: "fallback request",
    description: "If primary seeder fails, tries alternative seeders",
    code: "for (int fallback_port : valid_source_ports) { ... }",
  },
  {
    id: 17,
    phase: "Synchronization",
    actor1: "Download Thread",
    actor2: "Chunk Threads",
    message: "thread.join() barrier",
    description: "Waits for batch of 10 concurrent chunks to complete",
    code: "for (auto& thread : chunk_threads) { thread.join(); }",
  },
  {
    id: 18,
    phase: "File Assembly",
    actor1: "Download Thread",
    actor2: "File System",
    message: "reassemble chunks",
    description: "Writes completed chunks in order to create final file",
    code: "for (const auto& chunk : chunks) { outfile.write(chunk.data.data(), chunk.data.size()); }",
  },
  {
    id: 19,
    phase: "Progress Update",
    actor1: "Download Thread",
    actor2: "Main Thread",
    message: "atomic progress update",
    description: "Updates download progress using atomic counters",
    code: "downloaded_bytes.fetch_add(chunk.data.size());",
  },
  {
    id: 20,
    phase: "Completion",
    actor1: "Download Thread",
    actor2: "Main Thread",
    message: "download complete",
    description: "Signals successful file download completion",
    code: "download_completed = true;",
  },
]

const phases = [
  "Initialization",
  "Server Startup",
  "Client Discovery",
  "File Discovery",
  "Download Initiation",
  "Chunk Calculation",
  "Chunk Distribution",
  "Parallel Download",
  "Chunk Request",
  "Chunk Processing",
  "Chunk Response",
  "Fault Tolerance",
  "Synchronization",
  "File Assembly",
  "Progress Update",
  "Completion",
]

export default function SequenceDiagram() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null)

  const filteredSteps = selectedPhase ? sequenceSteps.filter((step) => step.phase === selectedPhase) : sequenceSteps

  const currentStepData = filteredSteps[currentStep] || sequenceSteps[0]

  const nextStep = () => {
    if (currentStep < filteredSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const reset = () => {
    setCurrentStep(0)
    setIsPlaying(false)
  }

  const togglePlay = () => {
    setIsPlaying(!isPlaying)
    if (!isPlaying) {
      const interval = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= filteredSteps.length - 1) {
            setIsPlaying(false)
            clearInterval(interval)
            return prev
          }
          return prev + 1
        })
      }, 2000)
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-foreground">P2P File Sharing System</h1>
          <p className="text-xl text-muted-foreground">Interactive Sequence Diagram</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>System Architecture Overview</CardTitle>
            <CardDescription>
              Visual representation of the P2P network topology and component interactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg p-8">
              {/* Network Topology */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                {/* Seeder Nodes */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-center mb-4">Seeder Network</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[9005, 9006, 9007, 9008, 9009].map((port, index) => (
                      <div key={port} className="relative">
                        <div
                          className={`p-4 rounded-lg border-2 text-center transition-all ${
                            currentStepData.message.includes(port.toString()) ||
                            currentStepData.actor2.includes(port.toString())
                              ? "border-primary bg-primary/10 shadow-lg scale-105"
                              : "border-muted bg-card"
                          }`}
                        >
                          <Server className="w-6 h-6 mx-auto mb-2" />
                          <div className="text-sm font-medium">Port {port}</div>
                          <div className="text-xs text-muted-foreground">seed{index + 1}/</div>
                        </div>
                        {/* Connection lines */}
                        {index < 4 && (
                          <div className="absolute top-1/2 -right-1.5 w-3 h-0.5 bg-muted-foreground/30"></div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Central Processing */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-center mb-4">Processing Core</h3>
                  <div className="space-y-3">
                    <div
                      className={`p-4 rounded-lg border-2 text-center ${
                        currentStepData.actor1 === "Main Thread" || currentStepData.actor2 === "Main Thread"
                          ? "border-primary bg-primary/10"
                          : "border-muted bg-card"
                      }`}
                    >
                      <Users className="w-6 h-6 mx-auto mb-2" />
                      <div className="text-sm font-medium">Main Thread</div>
                      <div className="text-xs text-muted-foreground">Coordination</div>
                    </div>
                    <div
                      className={`p-4 rounded-lg border-2 text-center ${
                        currentStepData.actor1 === "Server Thread" || currentStepData.actor2 === "Server Thread"
                          ? "border-secondary bg-secondary/10"
                          : "border-muted bg-card"
                      }`}
                    >
                      <Network className="w-6 h-6 mx-auto mb-2" />
                      <div className="text-sm font-medium">Server Thread</div>
                      <div className="text-xs text-muted-foreground">Accept Connections</div>
                    </div>
                    <div
                      className={`p-4 rounded-lg border-2 text-center ${
                        currentStepData.actor1.includes("Client Handler") ||
                        currentStepData.actor2.includes("Client Handler")
                          ? "border-accent bg-accent/10"
                          : "border-muted bg-card"
                      }`}
                    >
                      <Server className="w-6 h-6 mx-auto mb-2" />
                      <div className="text-sm font-medium">Client Handlers</div>
                      <div className="text-xs text-muted-foreground">Process Requests</div>
                    </div>
                  </div>
                </div>

                {/* Download Engine */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-center mb-4">Download Engine</h3>
                  <div className="space-y-3">
                    <div
                      className={`p-4 rounded-lg border-2 text-center ${
                        currentStepData.actor1.includes("Download Thread") ||
                        currentStepData.actor2.includes("Download Thread")
                          ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                          : "border-muted bg-card"
                      }`}
                    >
                      <Download className="w-6 h-6 mx-auto mb-2" />
                      <div className="text-sm font-medium">Download Thread</div>
                      <div className="text-xs text-muted-foreground">File Coordination</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[1, 2, 3, 4].map((chunk) => (
                        <div
                          key={chunk}
                          className={`p-2 rounded border text-center ${
                            currentStepData.actor1.includes("Chunk Thread") ||
                            currentStepData.phase === "Parallel Download"
                              ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20"
                              : "border-muted bg-card"
                          }`}
                        >
                          <div className="text-xs font-medium">Chunk {chunk}</div>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-center text-muted-foreground">+ 6 more parallel chunks</div>
                  </div>
                </div>
              </div>

              {/* Data Flow Arrows */}
              <div className="relative">
                <div className="flex justify-center items-center space-x-8">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-0.5 bg-primary"></div>
                    <ChevronRight className="w-4 h-4 text-primary" />
                    <span className="text-xs text-primary font-medium">File Discovery</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-0.5 bg-secondary"></div>
                    <ChevronRight className="w-4 h-4 text-secondary" />
                    <span className="text-xs text-secondary font-medium">Chunk Requests</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-0.5 bg-green-500"></div>
                    <ChevronRight className="w-4 h-4 text-green-500" />
                    <span className="text-xs text-green-500 font-medium">Data Transfer</span>
                  </div>
                </div>
              </div>

              {/* Current Phase Indicator */}
              <div className="mt-6 text-center">
                <Badge variant="outline" className="text-sm px-4 py-2">
                  Current Phase: {currentStepData.phase}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Phase Filter */}
        <Card>
          <CardHeader>
            <CardTitle>Filter by Phase</CardTitle>
            <CardDescription>Click on a phase to focus on specific interactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedPhase === null ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedPhase(null)
                  setCurrentStep(0)
                }}
              >
                All Phases
              </Button>
              {phases.map((phase) => (
                <Button
                  key={phase}
                  variant={selectedPhase === phase ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedPhase(phase)
                    setCurrentStep(0)
                  }}
                >
                  {phase}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button onClick={togglePlay} variant="outline">
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isPlaying ? "Pause" : "Play"}
                </Button>
                <Button onClick={reset} variant="outline">
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </Button>
                <Button onClick={prevStep} disabled={currentStep === 0} variant="outline">
                  Previous
                </Button>
                <Button onClick={nextStep} disabled={currentStep >= filteredSteps.length - 1} variant="outline">
                  Next
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                Step {currentStep + 1} of {filteredSteps.length}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Sequence Diagram */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sequence Visualization */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Sequence Flow</CardTitle>
                <Badge variant="secondary">{currentStepData.phase}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Actors */}
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="p-3 bg-primary/10 rounded-lg border">
                    <div className="font-semibold text-sm">Main Thread</div>
                  </div>
                  <div className="p-3 bg-secondary/10 rounded-lg border">
                    <div className="font-semibold text-sm">Server Thread</div>
                  </div>
                  <div className="p-3 bg-accent/10 rounded-lg border">
                    <div className="font-semibold text-sm">Client Handlers</div>
                  </div>
                  <div className="p-3 bg-muted/10 rounded-lg border">
                    <div className="font-semibold text-sm">Download Threads</div>
                  </div>
                </div>

                {/* Current Interaction */}
                <div className="bg-card border rounded-lg p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-primary rounded-full"></div>
                      <span className="font-medium">{currentStepData.actor1}</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{currentStepData.actor2}</span>
                      <div className="w-3 h-3 bg-secondary rounded-full"></div>
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                      <code className="text-sm font-mono">{currentStepData.message}</code>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground text-center">{currentStepData.description}</div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{Math.round(((currentStep + 1) / filteredSteps.length) * 100)}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${((currentStep + 1) / filteredSteps.length) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step Details */}
          <Card>
            <CardHeader>
              <CardTitle>Step Details</CardTitle>
              <CardDescription>Technical implementation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Phase</h4>
                <Badge>{currentStepData.phase}</Badge>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Description</h4>
                <p className="text-sm text-muted-foreground">{currentStepData.description}</p>
              </div>

              {currentStepData.code && (
                <div>
                  <h4 className="font-semibold mb-2">Code</h4>
                  <div className="bg-muted rounded-lg p-3">
                    <code className="text-sm font-mono">{currentStepData.code}</code>
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-semibold mb-2">Actors</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span className="text-sm">{currentStepData.actor1}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-secondary rounded-full"></div>
                    <span className="text-sm">{currentStepData.actor2}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* All Steps Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Complete Flow Overview</CardTitle>
            <CardDescription>All {filteredSteps.length} steps in the sequence</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredSteps.map((step, index) => (
                <div
                  key={step.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    index === currentStep ? "bg-primary/10 border-primary" : "bg-card hover:bg-muted/50"
                  }`}
                  onClick={() => setCurrentStep(index)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-xs">
                      {step.phase}
                    </Badge>
                    <span className="text-xs text-muted-foreground">#{step.id}</span>
                  </div>
                  <div className="text-sm font-medium mb-1">{step.message}</div>
                  <div className="text-xs text-muted-foreground">
                    {step.actor1} → {step.actor2}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
