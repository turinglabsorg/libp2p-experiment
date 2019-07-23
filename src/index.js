const multiaddr = require('multiaddr')
const PeerInfo = require('peer-info')
const Libp2p = require('libp2p')
const TCP = require('libp2p-tcp')
const defaultsDeep = require('@nodeutils/defaults-deep')
const Multiplex = require('libp2p-mplex')
const SECIO = require('libp2p-secio')
const Ping = require('libp2p-ping')
const pull = require('pull-stream')
const process = require('process')
const PeerId = require('peer-id')

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

    const publicAddress = multiaddr(`/ip4/0.0.0.0/tcp/11356`)
    peerInfo.multiaddrs.add(publicAddress)

    const peer = new P2PNode({peerInfo})

    peer.on('error', err => {
      console.error('libp2p error: ', err)
      throw err
    })

    peer.handle('/a-protocol', (protocol, conn) => {
      console.log(protocol,conn)
      pull(
        conn,
        pull.map((v) => v.toString()),
        pull.log()
      )
    })

    callback(null, peer)
  })
}

function startPeer(peer) {
    const addresses = peer.peerInfo.multiaddrs.toArray()
    console.log('peer started. listening on addresses:')
    addresses.forEach(addr => console.log(addr.toString()))
    pingRemotePeer(peer)
}

function pingRemotePeer(localPeer) {
  if (process.argv.length < 3) {
    return console.log('no remote peer address given, skipping ping')
  }
  const remoteAddr = multiaddr(process.argv[2])

  // Convert the multiaddress into a PeerInfo object
  const peerId = PeerId.createFromB58String(remoteAddr.getPeerId())
  const remotePeerInfo = new PeerInfo(peerId)
  remotePeerInfo.multiaddrs.add(remoteAddr)

  console.log('sending something to peer at', remoteAddr.toString())
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