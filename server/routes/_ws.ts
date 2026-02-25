import { addScanPeer, removeScanPeer } from '#server/utils/scanBroadcast'

export default defineWebSocketHandler({
  open(peer) {
    addScanPeer(peer)
  },
  close(peer) {
    removeScanPeer(peer)
  },
  error(peer, error) {
    console.error('[WebSocket] Error:', error)
    removeScanPeer(peer)
  }
})
