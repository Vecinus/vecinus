import { useEffect, useState } from 'react';
import { Linking } from 'react-native';

interface DeepLinkData {
  voteToken: string | null;
  pollId: string | null;
  isLoading: boolean;
  error: string | null;
}

export const useDeepLink = (): DeepLinkData => {
  const [voteToken, setVoteToken] = useState<string | null>(null);
  const [pollId, setPollId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleDeepLink = (url: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const urlObj = new URL(url);

        const token = urlObj.searchParams.get('token');
        const poll = urlObj.searchParams.get('poll');

        if (token && poll) {
          setVoteToken(token);
          setPollId(poll);
        } else if (token || poll) {
          setError('Invalid magic link format: missing token or poll_id');
        }
      } catch (err) {
        setError(`Failed to parse deep link: ${String(err)}`);
      } finally {
        setIsLoading(false);
      }
    };

    let subscription: any;

    const setupDeepLinking = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();

        if (initialUrl) {
          handleDeepLink(initialUrl);
        } else {
          setIsLoading(false);
        }

        subscription = Linking.addEventListener('url', ({ url }) => {
          handleDeepLink(url);
        });
      } catch (err) {
        setError(`Deep link setup error: ${String(err)}`);
        setIsLoading(false);
      }
    };

    setupDeepLinking();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  return { voteToken, pollId, isLoading, error };
};

export const useHandleVoteDeepLink = (voteToken: string | null, pollId: string | null) => {
  const navigate = (path: string) => {
    Linking.openURL(`vecinus://${path}`);
  };

  useEffect(() => {
    if (voteToken && pollId) {
      navigate(`polls/vote?token=${voteToken}&poll=${pollId}`);
    }
  }, [voteToken, pollId]);

  return { voteToken, pollId };
};
