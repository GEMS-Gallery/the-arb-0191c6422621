import React, { useState, useEffect } from 'react';
import { AuthClient } from '@dfinity/auth-client';
import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { backend } from 'declarations/backend';
import { Button, Card, CardContent, Typography, CircularProgress, Container, Box } from '@mui/material';

const SUB_ACCOUNT_ZERO = new Uint8Array(32);
const ACCOUNT_DOMAIN_SEPERATOR = new TextEncoder().encode("\x0Aaccount-id");

const to32bits = (num: number) => {
  let b = new ArrayBuffer(4);
  new DataView(b).setUint32(0, num);
  return Array.from(new Uint8Array(b));
};

const sha224 = async (message: Uint8Array): Promise<Uint8Array> => {
  console.log('SHA-224 input (hex):', Array.from(message, (b) => b.toString(16).padStart(2, '0')).join(''));

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  const H = [
    0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939,
    0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4
  ];

  const BLOCK_SIZE = 64;
  const HASH_SIZE = 28;

  const rightRotate = (value: number, amount: number): number => (value >>> amount) | (value << (32 - amount));

  const padMessage = (message: Uint8Array): Uint8Array => {
    const paddedLength = Math.ceil((message.length + 9) / BLOCK_SIZE) * BLOCK_SIZE;
    const padded = new Uint8Array(paddedLength);
    padded.set(message);
    padded[message.length] = 0x80;
    const bitLength = message.length * 8;
    new DataView(padded.buffer).setBigUint64(paddedLength - 8, BigInt(bitLength), false);
    return padded;
  };

  const processBlock = (block: Uint8Array, H: number[]): void => {
    const W = new Uint32Array(64);
    for (let i = 0; i < 16; i++) {
      W[i] = new DataView(block.buffer).getUint32(i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rightRotate(W[i-15], 7) ^ rightRotate(W[i-15], 18) ^ (W[i-15] >>> 3);
      const s1 = rightRotate(W[i-2], 17) ^ rightRotate(W[i-2], 19) ^ (W[i-2] >>> 10);
      W[i] = (W[i-16] + s0 + W[i-7] + s1) | 0;
    }

    let [a, b, c, d, e, f, g, h] = H;

    for (let i = 0; i < 64; i++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + W[i]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    H[0] = (H[0] + a) | 0;
    H[1] = (H[1] + b) | 0;
    H[2] = (H[2] + c) | 0;
    H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0;
    H[5] = (H[5] + f) | 0;
    H[6] = (H[6] + g) | 0;
    H[7] = (H[7] + h) | 0;
  };

  const padded = padMessage(message);
  for (let i = 0; i < padded.length; i += BLOCK_SIZE) {
    processBlock(padded.subarray(i, i + BLOCK_SIZE), H);
  }

  const result = new Uint8Array(HASH_SIZE);
  for (let i = 0; i < 7; i++) {
    new DataView(result.buffer).setUint32(i * 4, H[i], false);
  }

  console.log('SHA-224 output (hex):', Array.from(result, (b) => b.toString(16).padStart(2, '0')).join(''));

  return result;
};

const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff;
  const table = new Uint32Array(256);

  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
  }

  return crc ^ 0xffffffff;
};

const getAccountId = async (principal: Principal, subAccount: Uint8Array = SUB_ACCOUNT_ZERO) => {
  const principalArr = principal.toUint8Array();
  const accountId = new Uint8Array(
    ACCOUNT_DOMAIN_SEPERATOR.length + principalArr.length + subAccount.length
  );
  accountId.set(ACCOUNT_DOMAIN_SEPERATOR);
  accountId.set(principalArr, ACCOUNT_DOMAIN_SEPERATOR.length);
  accountId.set(subAccount, ACCOUNT_DOMAIN_SEPERATOR.length + principalArr.length);
  try {
    const hash = await sha224(accountId);
    const crc = crc32(hash);
    const crcBytes = new Uint8Array(4);
    new DataView(crcBytes.buffer).setUint32(0, crc, false);
    const result = new Uint8Array(crcBytes.length + hash.length);
    result.set(crcBytes);
    result.set(hash, crcBytes.length);
    return Array.from(result, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Error generating account ID:', error);
    throw new Error('Failed to generate account ID');
  }
};

const App: React.FC = () => {
  const [authClient, setAuthClient] = useState<AuthClient | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [principalId, setPrincipalId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    AuthClient.create().then(async (client) => {
      setAuthClient(client);
      const isAuthenticated = await client.isAuthenticated();
      setIsAuthenticated(isAuthenticated);
      if (isAuthenticated) {
        fetchBalance();
      }
    });
  }, []);

  const login = async () => {
    if (authClient) {
      await authClient.login({
        identityProvider: 'https://identity.ic0.app/#authorize',
        onSuccess: () => {
          setIsAuthenticated(true);
          fetchBalance();
        },
      });
    }
  };

  const logout = async () => {
    if (authClient) {
      await authClient.logout();
      setIsAuthenticated(false);
      setBalance(null);
      setPrincipalId(null);
      setAccountId(null);
    }
  };

  const fetchBalance = async () => {
    setLoading(true);
    try {
      const result = await backend.getBalance();
      if ('ok' in result) {
        setBalance(result.ok);
      } else {
        console.error('Error fetching balance:', result.err);
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
    setLoading(false);
  };

  const showIcpAccount = async () => {
    if (authClient) {
      try {
        const identity = await authClient.getIdentity();
        const principal = identity.getPrincipal();
        const principalId = principal.toText();
        setPrincipalId(principalId);
        const accountId = await getAccountId(principal);
        setAccountId(accountId);
      } catch (error) {
        console.error('Error getting ICP account:', error);
        setPrincipalId('Error: Unable to fetch Principal');
        setAccountId('Error: Unable to derive Account ID');
      }
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Token Balance App
        </Typography>
        {isAuthenticated ? (
          <>
            <Button variant="contained" color="primary" onClick={logout} sx={{ mr: 2 }}>
              Sign Out
            </Button>
            <Button variant="contained" color="secondary" onClick={showIcpAccount}>
              Show ICP Account
            </Button>
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h5" component="div">
                  Your Balance
                </Typography>
                {loading ? (
                  <CircularProgress />
                ) : (
                  <Typography variant="h4">
                    {balance !== null ? balance.toString() : 'N/A'}
                  </Typography>
                )}
                {principalId && (
                  <Typography variant="body1" sx={{ mt: 2 }}>
                    Principal ID: {principalId}
                  </Typography>
                )}
                {accountId && (
                  <Typography variant="body1" sx={{ mt: 1 }}>
                    Account ID: {accountId}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Button variant="contained" color="primary" onClick={login}>
            Sign In with Internet Identity
          </Button>
        )}
      </Box>
    </Container>
  );
};

export default App;
