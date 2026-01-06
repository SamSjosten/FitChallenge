// app/(tabs)/index.tsx
// Home/Dashboard screen

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/src/hooks/useAuth';
import { useActiveChallenges, usePendingInvites, useRespondToInvite } from '@/src/hooks/useChallenges';
import { Button, Card, LoadingScreen, ErrorMessage, EmptyState } from '@/src/components/ui';

export default function HomeScreen() {
  const { profile } = useAuth();
  const { 
    data: activeChallenges, 
    isLoading: loadingActive,
    error: activeError,
    refetch: refetchActive,
  } = useActiveChallenges();
  const { 
    data: pendingInvites, 
    isLoading: loadingPending,
    refetch: refetchPending,
  } = usePendingInvites();
  const respondToInvite = useRespondToInvite();

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchActive(), refetchPending()]);
    setRefreshing(false);
  };

  const handleAcceptInvite = async (challengeId: string) => {
    try {
      await respondToInvite.mutateAsync({ challenge_id: challengeId, response: 'accepted' });
    } catch (err) {
      console.error('Failed to accept invite:', err);
    }
  };

  const handleDeclineInvite = async (challengeId: string) => {
    try {
      await respondToInvite.mutateAsync({ challenge_id: challengeId, response: 'declined' });
    } catch (err) {
      console.error('Failed to decline invite:', err);
    }
  };

  if (loadingActive && loadingPending && !refreshing) {
    return <LoadingScreen />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Welcome Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Hello, {profile?.display_name || profile?.username || 'Athlete'}!
        </Text>
        <Text style={styles.stats}>
          🔥 {profile?.current_streak || 0} day streak • ⭐ {profile?.xp_total || 0} XP
        </Text>
      </View>

      {/* Pending Invites */}
      {pendingInvites && pendingInvites.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Invites</Text>
          {pendingInvites.map((invite) => (
            <Card key={invite.challenge.id} style={styles.inviteCard}>
              <Text style={styles.inviteTitle}>{invite.challenge.title}</Text>
              <Text style={styles.inviteFrom}>
                From {invite.creator.display_name || invite.creator.username}
              </Text>
              <Text style={styles.inviteDetails}>
                {invite.challenge.challenge_type} • Goal: {invite.challenge.goal_value} {invite.challenge.goal_unit}
              </Text>
              <View style={styles.inviteActions}>
                <Button
                  title="Accept"
                  size="small"
                  onPress={() => handleAcceptInvite(invite.challenge.id)}
                  loading={respondToInvite.isPending}
                  style={styles.acceptButton}
                />
                <Button
                  title="Decline"
                  variant="outline"
                  size="small"
                  onPress={() => handleDeclineInvite(invite.challenge.id)}
                  loading={respondToInvite.isPending}
                />
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* Active Challenges */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Challenges</Text>
          <Button
            title="+ New"
            variant="outline"
            size="small"
            onPress={() => router.push('/challenge/create')}
          />
        </View>

        {activeError && (
          <ErrorMessage 
            message="Failed to load challenges" 
            onRetry={refetchActive}
          />
        )}

        {activeChallenges && activeChallenges.length === 0 && (
          <EmptyState
            title="No active challenges"
            message="Create a challenge or accept an invite to get started"
            actionLabel="Create Challenge"
            onAction={() => router.push('/challenge/create')}
          />
        )}

        {activeChallenges?.map((challenge) => (
          <Card
            key={challenge.id}
            style={styles.challengeCard}
            onPress={() => router.push(`/challenge/${challenge.id}`)}
          >
            <View style={styles.challengeHeader}>
              <Text style={styles.challengeTitle}>{challenge.title}</Text>
              <View style={[
                styles.statusBadge,
                challenge.status === 'active' ? styles.statusActive : styles.statusPending
              ]}>
                <Text style={styles.statusText}>
                  {challenge.status === 'active' ? 'Active' : 'Starting Soon'}
                </Text>
              </View>
            </View>
            <Text style={styles.challengeType}>
              {challenge.challenge_type.replace('_', ' ')}
            </Text>
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>
                {challenge.my_participation?.current_progress || 0} / {challenge.goal_value} {challenge.goal_unit}
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(
                        ((challenge.my_participation?.current_progress || 0) / challenge.goal_value) * 100,
                        100
                      )}%`,
                    },
                  ]}
                />
              </View>
            </View>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  stats: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  inviteCard: {
    marginBottom: 12,
  },
  inviteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  inviteFrom: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 4,
  },
  inviteDetails: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 12,
  },
  acceptButton: {
    flex: 1,
  },
  challengeCard: {
    marginBottom: 12,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusActive: {
    backgroundColor: '#34C759',
  },
  statusPending: {
    backgroundColor: '#FF9500',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  challengeType: {
    fontSize: 13,
    color: '#666',
    textTransform: 'capitalize',
    marginBottom: 12,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
});
