import React, { useState, useEffect } from 'react';
import { AuthClient } from '@dfinity/auth-client';
import { Actor, HttpAgent } from '@dfinity/agent';
import { backend } from 'declarations/backend';
import { Button, Card, CardContent, Typography, CircularProgress, Container, Box } from '@mui/material';

const App: React.FC = () => {
  const [authClient, setAuthClient] = useState<AuthClient | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

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

  return (
    <Container maxWidth="sm">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Token Balance App
        </Typography>
        {isAuthenticated ? (
          <>
            <Button variant="contained" color="primary" onClick={logout}>
              Sign Out
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
