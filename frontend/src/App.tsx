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

const getAccountId = async (principal: Principal, subAccount: Uint8Array = SUB_ACCOUNT_ZERO) => {
  const principalArr = principal.toUint8Array();
  const accountId = new Uint8Array(
    ACCOUNT_DOMAIN_SEPERATOR.length + principalArr.length + subAccount.length
  );
  accountId.set(ACCOUNT_DOMAIN_SEPERATOR);
  accountId.set(principalArr, ACCOUNT_DOMAIN_SEPERATOR.length);
  accountId.set(subAccount, ACCOUNT_DOMAIN_SEPERATOR.length + principalArr.length);
  try {
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", accountId));
    // Truncate to 224 bits (28 bytes) to simulate SHA-224
    const truncatedHash = hash.slice(0, 28);
    return Array.from(truncatedHash, (b) => b.toString(16).padStart(2, '0')).join('');
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
