// app/challenge/create.tsx
// Create new challenge screen

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { useCreateChallenge } from '@/src/hooks/useChallenges';
import { Button, Input, Card } from '@/src/components/ui';
import type { ChallengeType } from '@/src/types/database';

const CHALLENGE_TYPES: { value: ChallengeType; label: string; unit: string }[] = [
  { value: 'steps', label: '👟 Steps', unit: 'steps' },
  { value: 'active_minutes', label: '⏱️ Active Minutes', unit: 'minutes' },
  { value: 'workouts', label: '💪 Workouts', unit: 'workouts' },
  { value: 'distance', label: '🏃 Distance', unit: 'km' },
];

export default function CreateChallengeScreen() {
  const createChallenge = useCreateChallenge();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [challengeType, setChallengeType] = useState<ChallengeType>('steps');
  const [goalValue, setGoalValue] = useState('');
  const [durationDays, setDurationDays] = useState('7');
  const [error, setError] = useState<string | null>(null);

  const selectedType = CHALLENGE_TYPES.find((t) => t.value === challengeType)!;

  const handleCreate = async () => {
    setError(null);

    // Basic validation
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!goalValue || parseInt(goalValue) <= 0) {
      setError('Please enter a valid goal');
      return;
    }
    if (!durationDays || parseInt(durationDays) <= 0) {
      setError('Please enter a valid duration');
      return;
    }

    const now = new Date();
    const startDate = new Date(now.getTime() + 60000); // Start in 1 minute
    const endDate = new Date(startDate.getTime() + parseInt(durationDays) * 24 * 60 * 60 * 1000);

    try {
      await createChallenge.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        challenge_type: challengeType,
        goal_value: parseInt(goalValue),
        goal_unit: selectedType.unit,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        win_condition: 'highest_total',
      });

      Alert.alert(
        'Challenge Created! 🎉',
        'Your challenge is ready. Invite friends to join!',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (err: any) {
      setError(err.message || 'Failed to create challenge');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.header}>Create a Challenge</Text>

        {/* Title */}
        <Input
          label="Challenge Title"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g., Summer Step Challenge"
          maxLength={100}
        />

        {/* Description */}
        <Input
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="What's this challenge about?"
          multiline
          numberOfLines={3}
          maxLength={500}
        />

        {/* Challenge Type */}
        <Text style={styles.label}>Challenge Type</Text>
        <View style={styles.typeGrid}>
          {CHALLENGE_TYPES.map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.typeCard,
                challengeType === type.value && styles.typeCardSelected,
              ]}
              onPress={() => setChallengeType(type.value)}
            >
              <Text style={styles.typeLabel}>{type.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Goal */}
        <Input
          label={`Goal (${selectedType.unit})`}
          value={goalValue}
          onChangeText={setGoalValue}
          placeholder={`e.g., 10000`}
          keyboardType="number-pad"
        />

        {/* Duration */}
        <Input
          label="Duration (days)"
          value={durationDays}
          onChangeText={setDurationDays}
          placeholder="7"
          keyboardType="number-pad"
        />

        {/* Summary */}
        <Card style={styles.summary}>
          <Text style={styles.summaryTitle}>Challenge Summary</Text>
          <Text style={styles.summaryText}>
            {title || 'Your challenge'} • {goalValue || '?'} {selectedType.unit} in {durationDays || '?'} days
          </Text>
        </Card>

        {/* Error */}
        {error && <Text style={styles.error}>{error}</Text>}

        {/* Create Button */}
        <Button
          title="Create Challenge"
          onPress={handleCreate}
          loading={createChallenge.isPending}
          disabled={createChallenge.isPending}
          size="large"
        />

        {/* Cancel */}
        <Button
          title="Cancel"
          variant="outline"
          onPress={() => router.back()}
          style={styles.cancelButton}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  typeCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  typeCardSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  summary: {
    marginBottom: 16,
    backgroundColor: '#F0F8FF',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 14,
    color: '#333',
  },
  error: {
    color: '#FF3B30',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: 12,
  },
});
