const multiaddr = require('multiaddr')
const PeerInfo = require('peer-info')
const Libp2p = require('libp2p')
const TCP = require('libp2p-tcp')
const defaultsDeep = require('@nodeutils/defaults-deep')
const Multiplex = require('libp2p-mplex')
const SECIO = require('libp2p-secio')
const pull = require('pull-stream')
const process = require('process')
const PeerId = require('peer-id')
const fs = require('fs')

const DEFAULT_OPTS = {
  modules: {
    transport: [
      TCP
    ],
    connEncryption: [
      SECIO
    ],
    streamMuxer: [
      Multiplex
    ]
  }
}

class P2PNode extends Libp2p {
  constructor (opts) {
    super(defaultsDeep(opts, DEFAULT_OPTS))
  }
}

function createPeer(callback) {
  // create a new PeerInfo object with a newly-generated PeerId
  PeerInfo.create((err, peerInfo) => {
    if (err) {
      return callback(err)
    }

    const publicAddress = multiaddr(`/ip4/0.0.0.0/tcp/0`)
    peerInfo.multiaddrs.add(publicAddress)

    const peer = new P2PNode({peerInfo})

    peer.on('error', err => {
      console.error('libp2p error: ', err)
      throw err
    })

    peer.handle('/a-protocol', (protocol, conn) => {
      pull( 
        conn,
        pull.map((v) => {
          log('Message received: ' + v.toString())
        }),
        pull.drain()
      )
    })

    callback(null, peer)
  })
}

function log(toLog){
  console.log(toLog)
  var d = new Date().toLocaleString();
  fs.appendFileSync('log', '[' + d + '] ' + toLog + '\n');
}

function startPeer(peer) {
    const addresses = peer.peerInfo.multiaddrs.toArray()
    log('peer started. listening on addresses:')
    addresses.forEach(addr => log(addr.toString()))
    pingRemotePeer(peer)
}

function pingRemotePeer(localPeer) {
  if (process.argv.length < 3) {
    return log('no remote peer address given, skipping ping')
  }
  const remoteAddr = multiaddr(process.argv[2])

  // Convert the multiaddress into a PeerInfo object
  const peerId = PeerId.createFromB58String(remoteAddr.getPeerId())
  const remotePeerInfo = new PeerInfo(peerId)
  remotePeerInfo.multiaddrs.add(remoteAddr)

  log('sending something to peer at ' + remoteAddr.toString())
  localPeer.dialProtocol(remotePeerInfo, '/a-protocol', (err, conn) => {
    if (err) { throw err }
    pull(pull.values(['TEST SEND SOMETHING']), conn)
  })
}

createPeer((err, peer) => {
    if (err) {
    throw err
    }

    peer.start(err => {
      if (err) {
          throw err
      }

      startPeer(peer)
    })
})