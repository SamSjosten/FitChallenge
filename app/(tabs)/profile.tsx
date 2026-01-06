// app/(tabs)/profile.tsx
// Profile screen - displays user's own profile data

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/src/hooks/useAuth';
import { authService } from '@/src/services/auth';
import { Button, Card, Input, LoadingScreen } from '@/src/components/ui';

export default function ProfileScreen() {
  const { profile, user, loading, signOut, refreshProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await authService.updateProfile({ display_name: displayName });
      await refreshProfile();
      setIsEditing(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  if (loading || !profile) {
    return <LoadingScreen />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>
              {(profile.display_name || profile.username)?.[0]?.toUpperCase() || '?'}
            </Text>
          )}
        </View>
        <Text style={styles.displayName}>
          {profile.display_name || profile.username}
        </Text>
        <Text style={styles.username}>@{profile.username}</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{profile.xp_total}</Text>
          <Text style={styles.statLabel}>Total XP</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{profile.current_streak}</Text>
          <Text style={styles.statLabel}>Current Streak</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{profile.longest_streak}</Text>
          <Text style={styles.statLabel}>Longest Streak</Text>
        </Card>
      </View>

      {/* Profile Info */}
      <Card style={styles.infoCard}>
        <Text style={styles.cardTitle}>Profile Info</Text>
        
        {isEditing ? (
          <>
            <Input
              label="Display Name"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your display name"
            />
            <View style={styles.editActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => {
                  setIsEditing(false);
                  setDisplayName(profile.display_name || '');
                }}
                style={styles.editButton}
              />
              <Button
                title="Save"
                onPress={handleSave}
                loading={saving}
                style={styles.editButton}
              />
            </View>
          </>
        ) : (
          <>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Username</Text>
              <Text style={styles.infoValue}>@{profile.username}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Display Name</Text>
              <Text style={styles.infoValue}>{profile.display_name || 'Not set'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Member Since</Text>
              <Text style={styles.infoValue}>
                {new Date(profile.created_at).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Premium</Text>
              <Text style={styles.infoValue}>
                {profile.is_premium ? '✓ Active' : 'Not active'}
              </Text>
            </View>
            <Button
              title="Edit Profile"
              variant="outline"
              onPress={() => setIsEditing(true)}
              style={styles.editProfileButton}
            />
          </>
        )}
      </Card>

      {/* Account Actions */}
      <Card style={styles.actionsCard}>
        <Text style={styles.cardTitle}>Account</Text>
        <Button
          title="Sign Out"
          variant="danger"
          onPress={handleSignOut}
        />
      </Card>
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
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  username: {
    fontSize: 16,
    color: '#666',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  infoCard: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
  editProfileButton: {
    marginTop: 16,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  editButton: {
    flex: 1,
  },
  actionsCard: {
    marginBottom: 32,
  },
});
