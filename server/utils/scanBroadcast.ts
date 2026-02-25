import type { Peer } from 'crossws'

export interface BroadcastEvent {
  channel?: 'scan' | 'upload' | 'package-job'
  type: string
  message: string
  serverId?: string
  uploadId?: string
  data?: any
}

// Store connected WebSocket peers
const peers = new Set<Peer>()

export function addScanPeer(peer: Peer) {
  peers.add(peer)
}

export function removeScanPeer(peer: Peer) {
  peers.delete(peer)
}

export function broadcastScanEvent(event: BroadcastEvent) {
  const message = JSON.stringify(event)
  for (const peer of peers) {
    try {
      peer.send(message)
    } catch (e) {
      // Peer might be disconnected, remove it
      peers.delete(peer)
    }
  }
}

export function getScanPeersCount() {
  return peers.size
}
