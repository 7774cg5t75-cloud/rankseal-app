import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
  Share,
  TextInput,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { VideoView, useVideoPlayer } from 'expo-video';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://gilbsqbfrvldpscbfert.supabase.co',
  'sb_publishable_ROci_eJJYN6yRqjtmjj99Q_VmG95ZIW'
);
function ReviewVideoPlayer({ uri }) {
  const player = useVideoPlayer(uri);

  return (
    <VideoView
      style={styles.reviewVideo}
      player={player}
      nativeControls
      contentFit="contain"
      allowsFullscreen
    />
  );
}

export default function App() {
  const [screen, setScreen] = useState('home');
  const [phase, setPhase] = useState('ready');

  const [countdown, setCountdown] = useState(3);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [finalTime, setFinalTime] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [videoUri, setVideoUri] = useState(null);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [cameraSetupConfirmed, setCameraSetupConfirmed] = useState(false);
  const [cameraFacing, setCameraFacing] = useState('front');
  const [precheckConfirmed, setPrecheckConfirmed] = useState(false);
  const [flipHoldReady, setFlipHoldReady] = useState(false);
  const [submittingAttempt, setSubmittingAttempt] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [attempts, setAttempts] = useState([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [attemptsError, setAttemptsError] = useState('');
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [reviewAttempt, setReviewAttempt] = useState(null);
  const [reviewReasonInput, setReviewReasonInput] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewQueueNotice, setReviewQueueNotice] = useState('');
  const [reviewVideoUrl, setReviewVideoUrl] = useState('');
  const [reviewVideoLoading, setReviewVideoLoading] = useState(false);
  const [reviewVideoError, setReviewVideoError] = useState('');
  const [uploadProgressText, setUploadProgressText] = useState('');
  // Challenge-specific cooldown.
  // PROTOTYPE TEST VALUE ONLY: 1 minute so we can test the flow.
  // Replace this one value when the production 568 cooldown is decided.
  const COOLDOWN_MS_568 = 60 * 1000;
  const COOLDOWN_SECONDS_568 = Math.round(COOLDOWN_MS_568 / 1000);
  const COOLDOWN_CHALLENGE_KEY_568 = '568';

  // Prototype-only client key. When RankSeal gets user accounts this becomes
  // the authenticated user's ID, so each person's cooldown is isolated.
  const COOLDOWN_CLIENT_KEY = 'prototype-primary-tester';

  const ATTEMPT_VIDEO_BUCKET = 'attempt-videos';
  const ATTEMPT_VIDEO_FOLDER = 'prototype-primary-tester';

  const [cooldownEndsAt568, setCooldownEndsAt568] = useState(0);
  const [cooldownRemaining568, setCooldownRemaining568] = useState(0);
  const [cooldownChecking568, setCooldownChecking568] = useState(true);
  const [cooldownError568, setCooldownError568] = useState('');

  const [permission, requestPermission] = useCameraPermissions();

  const cameraRef = useRef(null);
  const timerRef = useRef(null);
  const startRef = useRef(0);
  const recordingPromiseRef = useRef(null);

  const formatTime = (ms) => ((ms || 0) / 1000).toFixed(2);

  const is568CooldownActive = cooldownRemaining568 > 0;

  const formatCooldown = (ms) => {
    const totalSeconds = Math.max(0, Math.ceil((ms || 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  const restore568Cooldown = async () => {
    setCooldownChecking568(true);
    setCooldownError568('');

    const { data, error } = await supabase
      .from('cooldown_events')
      .select('created_at, cooldown_seconds')
      .eq('challenge_key', COOLDOWN_CHALLENGE_KEY_568)
      .eq('client_key', COOLDOWN_CLIENT_KEY)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log('Cooldown restore error:', error);
      setCooldownError568('Could not check the 568 cooldown right now.');
      setCooldownChecking568(false);
      return;
    }

    if (!data) {
      setCooldownEndsAt568(0);
      setCooldownRemaining568(0);
      setCooldownChecking568(false);
      return;
    }

    const serverStart = new Date(data.created_at).getTime();
    const serverEnd =
      serverStart + Number(data.cooldown_seconds || 0) * 1000;
    const remaining = Math.max(0, serverEnd - Date.now());

    if (remaining > 0) {
      setCooldownEndsAt568(serverEnd);
      setCooldownRemaining568(remaining);
    } else {
      setCooldownEndsAt568(0);
      setCooldownRemaining568(0);
    }

    setCooldownChecking568(false);
  };

  const begin568Cooldown = async () => {
    // Lock immediately in the current session at GO.
    const localEndsAt = Date.now() + COOLDOWN_MS_568;
    setCooldownEndsAt568(localEndsAt);
    setCooldownRemaining568(COOLDOWN_MS_568);
    setCooldownError568('');

    const { data, error } = await supabase
      .from('cooldown_events')
      .insert({
        challenge_key: COOLDOWN_CHALLENGE_KEY_568,
        client_key: COOLDOWN_CLIENT_KEY,
        cooldown_seconds: COOLDOWN_SECONDS_568,
      })
      .select('created_at, cooldown_seconds')
      .single();

    if (error) {
      console.log('Cooldown save error:', error);
      setCooldownError568(
        'The cooldown is active on this device, but it could not be saved to the server.'
      );
      return;
    }

    // Use Supabase's timestamp as the authoritative start when available.
    const serverStart = new Date(data.created_at).getTime();
    const serverEnd =
      serverStart + Number(data.cooldown_seconds || COOLDOWN_SECONDS_568) * 1000;
    const remaining = Math.max(0, serverEnd - Date.now());

    setCooldownEndsAt568(serverEnd);
    setCooldownRemaining568(remaining);
  };

  const activeAttemptTime = selectedAttempt?.time_ms ?? finalTime;

  const shareVerifiedResult = async () => {
    try {
      await Share.share({
        message: `I recorded a verified ${formatTime(activeAttemptTime)} second time on The 568 Challenge with RankSeal.`,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  const fetchAttempts = async () => {
    setAttemptsLoading(true);
    setAttemptsError('');

    const { data, error } = await supabase
      .from('attempts')
      .select('id, created_at, time_ms, video_path, status, review_reason, reviewed_at')
      .order('created_at', { ascending: false })
      .limit(25);

    if (error) {
      console.log('Load attempts error:', error);
      setAttempts([]);
      setAttemptsError('Could not load attempts from Supabase.');
      setAttemptsLoading(false);
      return;
    }

    setAttempts(data || []);
    setAttemptsLoading(false);
  };

  const openAttempt = (attempt) => {
    setSelectedAttempt(attempt);

    if (attempt.status === 'verified') {
      setScreen('verifiedResult');
      return;
    }

    if (attempt.status === 'rejected') {
      setScreen('notVerified');
      return;
    }

    setScreen('pending');
  };

  const getAttemptStatusLabel = (status) => {
    if (status === 'verified') return 'VERIFIED';
    if (status === 'rejected') return 'NOT VERIFIED';
    return 'PENDING';
  };

  const getAttemptStatusTitle = (status) => {
    if (status === 'verified') return 'Verified result';
    if (status === 'rejected') return 'Not verified';
    return 'Pending verification';
  };

  const getAttemptStatusText = (attempt) => {
    if (attempt.status === 'verified') {
      return 'This attempt passed verification and counts as an official RankSeal result.';
    }

    if (attempt.status === 'rejected') {
      return attempt.review_reason || 'This attempt could not be verified.';
    }

    return 'This attempt has been submitted and is waiting to be checked.';
  };

  const verifiedAttempts = attempts
    .filter((attempt) => attempt.status === 'verified')
    .sort((a, b) => Number(a.time_ms) - Number(b.time_ms));

  const worldLeaderAttempt = verifiedAttempts[0] || null;

  const getWorldRank = (attemptId) => {
    const index = verifiedAttempts.findIndex((attempt) => attempt.id === attemptId);
    return index >= 0 ? index + 1 : null;
  };


  const loadReviewVideo = async (attempt) => {
    setReviewVideoUrl('');
    setReviewVideoError('');

    if (
      !attempt?.video_path ||
      attempt.video_path === 'prototype-test'
    ) {
      setReviewVideoLoading(false);
      setReviewVideoError(
        'This older prototype attempt does not have an uploaded video.'
      );
      return;
    }

    setReviewVideoLoading(true);

    const { data, error } = await supabase.storage
      .from(ATTEMPT_VIDEO_BUCKET)
      .createSignedUrl(attempt.video_path, 60 * 60);

    if (error || !data?.signedUrl) {
      console.log('Signed video URL error:', error);
      setReviewVideoError(
        `Could not load this video: ${error?.message || 'Signed URL unavailable.'}`
      );
      setReviewVideoLoading(false);
      return;
    }

    setReviewVideoUrl(data.signedUrl);
    setReviewVideoLoading(false);
  };

  const openReviewAttempt = (attempt) => {
    setReviewAttempt(attempt);
    setReviewReasonInput(attempt.review_reason || '');
    setReviewMessage('');
    setReviewVideoUrl('');
    setReviewVideoError('');
    setScreen('reviewDetail');
    loadReviewVideo(attempt);
  };

  const saveReviewDecision = async (decision) => {
    if (!reviewAttempt) {
      setReviewMessage('No attempt is selected.');
      return;
    }

    if (decision === 'rejected' && !reviewReasonInput.trim()) {
      setReviewMessage('Enter a reason before rejecting this attempt.');
      return;
    }

    setReviewSaving(true);
    setReviewMessage('');

    const updatePayload = {
      status: decision,
      review_reason:
        decision === 'rejected' ? reviewReasonInput.trim() : null,
      reviewed_at: new Date().toISOString(),
    };

    const { data: updatedAttempt, error } = await supabase
      .from('attempts')
      .update(updatePayload)
      .eq('id', reviewAttempt.id)
      .select(
        'id, created_at, time_ms, video_path, status, review_reason, reviewed_at'
      )
      .maybeSingle();

    if (error) {
      console.log('Review update error:', error);
      setReviewMessage(
        `Could not save this review: ${error.message || 'Supabase update failed.'}`
      );
      setReviewSaving(false);
      return;
    }

    if (!updatedAttempt) {
      setReviewMessage(
        'Supabase did not update any row. The UPDATE permission or row policy is still blocking this attempt.'
      );
      setReviewSaving(false);
      return;
    }

    if (updatedAttempt.status !== decision) {
      setReviewMessage(
        `Supabase returned the row, but its status is still "${updatedAttempt.status}".`
      );
      setReviewSaving(false);
      return;
    }

    // Update the app immediately instead of waiting for another fetch.
    setAttempts((current) =>
      current.map((attempt) =>
        attempt.id === updatedAttempt.id ? updatedAttempt : attempt
      )
    );

    const decisionLabel =
      decision === 'verified' ? 'verified' : 'marked not verified';

    setReviewQueueNotice(
      `Attempt #${updatedAttempt.id} was ${decisionLabel} and saved to Supabase.`
    );

    setReviewAttempt(null);
    setReviewReasonInput('');
    setReviewMessage('');
    setReviewSaving(false);
    setScreen('reviewQueue');

    // Refresh from the server as a second confirmation.
    fetchAttempts();
  };

  const pendingReviewAttempts = attempts.filter(
    (attempt) => attempt.status === 'pending'
  );

  const resetAttempt = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setPhase('setup');
    setCountdown(3);
    setRunning(false);
    setElapsed(0);
    setFinalTime(0);
    setVideoUri(null);
    setSubmittingAttempt(false);
    setSubmitError('');
    setUploadProgressText('');
  };

  const openCamera = () => {
    if (cooldownChecking568 || cooldownError568 || is568CooldownActive) {
      setScreen('challenge568');
      return;
    }

    resetAttempt();
    setSelectedAttempt(null);
    setCameraSetupConfirmed(false);
    setPrecheckConfirmed(false);
    setScreen('camera');
  };
  const uploadAttemptVideo = async () => {
    if (!videoUri) {
      throw new Error('No recorded video is available to upload.');
    }

    setUploadProgressText('Preparing video…');

    const uriWithoutQuery = videoUri.split('?')[0];
    const extensionMatch = uriWithoutQuery.match(/\.([a-zA-Z0-9]+)$/);
    const extension = extensionMatch ? extensionMatch[1].toLowerCase() : 'mp4';
    const contentType =
      extension === 'mov' ? 'video/quicktime' : 'video/mp4';

    const fileName =
      `${Date.now()}-${Math.max(0, Math.round(finalTime))}.${extension}`;
    const storagePath = `${ATTEMPT_VIDEO_FOLDER}/${fileName}`;

    setUploadProgressText('Reading video…');

    const response = await fetch(videoUri);

    if (!response.ok) {
      throw new Error(`Could not read recorded video (${response.status}).`);
    }

    const fileBuffer = await response.arrayBuffer();

    if (!fileBuffer || fileBuffer.byteLength === 0) {
      throw new Error('The recorded video file was empty.');
    }

    setUploadProgressText('Uploading video…');

    const { error: uploadError } = await supabase.storage
      .from(ATTEMPT_VIDEO_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    return storagePath;
  };

const submitAttempt = async () => {
  if (submittingAttempt) return;

  setSubmittingAttempt(true);
  setSubmitError('');
  setUploadProgressText('');

  try {
    const videoPath = await uploadAttemptVideo();

    setUploadProgressText('Saving attempt…');

    const { error } = await supabase
      .from('attempts')
      .insert({
        time_ms: finalTime,
        video_path: videoPath,
        status: 'pending',
      });

    if (error) {
      throw error;
    }

    setUploadProgressText('');
    setSubmittingAttempt(false);
    setScreen('pending');
  } catch (error) {
    console.log('Submit/upload error:', error);
    setSubmitError(
      `Could not submit this attempt: ${error?.message || 'Video upload failed.'}`
    );
    setUploadProgressText('');
    setSubmittingAttempt(false);
  }
};
  const startCountdown = () => {
    if (!cameraRef.current || !cameraReady) return;

    setPhase('countdown');
    setCountdown(3);

    try {
      recordingPromiseRef.current = cameraRef.current.recordAsync();
    } catch (error) {
      console.log('Could not start recording:', error);
    }
  };

  useEffect(() => {
    if (!cooldownEndsAt568) {
      setCooldownRemaining568(0);
      return;
    }

    const updateCooldown = () => {
      const remaining = Math.max(0, cooldownEndsAt568 - Date.now());
      setCooldownRemaining568(remaining);

      if (remaining <= 0) {
        setCooldownEndsAt568(0);
      }
    };

    updateCooldown();
    const cooldownTimer = setInterval(updateCooldown, 250);

    return () => clearInterval(cooldownTimer);
  }, [cooldownEndsAt568]);

  useEffect(() => {
    restore568Cooldown();
  }, []);

  useEffect(() => {
    if (screen === 'challenge568' || screen === 'rules') {
      restore568Cooldown();
    }
  }, [screen]);

  useEffect(() => {
    if (
      screen === 'attempts' ||
      screen === 'challenge568' ||
      screen === 'leaderboard' ||
      screen === 'reviewQueue'
    ) {
      fetchAttempts();
    }
  }, [screen]);

  useEffect(() => {
    if (screen !== 'camera' || phase !== 'countdown') return;

    if (countdown <= 0) {
      startRef.current = Date.now();

      // The 568 cooldown starts at GO and is persisted to Supabase.
      begin568Cooldown();

      setElapsed(0);
      setRunning(true);
      setPhase('drinking');
      return;
    }

    const id = setTimeout(() => {
      setCountdown((value) => value - 1);
    }, 1000);

    return () => clearTimeout(id);
  }, [screen, phase, countdown]);

  useEffect(() => {
    if (!running) return;

    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startRef.current);
    }, 30);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running]);

  useEffect(() => {
    if (phase !== 'flip') {
      setFlipHoldReady(false);
      return;
    }

    const holdTimer = setTimeout(() => {
      setFlipHoldReady(true);
    }, 3000);

    return () => clearTimeout(holdTimer);
  }, [phase]);

  const stopAttempt = () => {
    if (!running) return;

    const result = Date.now() - startRef.current;

    if (timerRef.current) clearInterval(timerRef.current);

    setElapsed(result);
    setFinalTime(result);
    setRunning(false);

    // IMPORTANT: we do NOT stop the camera recording here.
    setPhase('flip');
  };

  const finishRecording = async () => {
    try {
      if (cameraRef.current) {
        cameraRef.current.stopRecording();
      }

      if (recordingPromiseRef.current) {
        const video = await recordingPromiseRef.current;
        if (video?.uri) {
          setVideoUri(video.uri);
        }
      }
    } catch (error) {
      console.log('Could not finish recording:', error);
    }

    setScreen('result');
  };

  if (screen === 'challenge568') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.screenScroll}
          contentContainerStyle={styles.challengeScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => setScreen('home')} style={styles.backButton}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>

          <View>
            <Text style={styles.eyebrow}>RANKSEAL CHALLENGE</Text>
            <Text style={styles.title}>The 568 Challenge</Text>
            <Text style={styles.challengeDescription}>
              How fast can you drink 568 ml of water?
            </Text>
            <Text style={styles.challengeSubline}>Fastest verified time wins.</Text>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>YOUR BEST</Text>
                <Text style={styles.statValue}>Not ranked</Text>
                <Text style={styles.statHint}>Complete a verified attempt</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>WORLD LEADER</Text>
                <Text style={styles.statValue}>
                  {worldLeaderAttempt
                    ? `${formatTime(worldLeaderAttempt.time_ms)}s`
                    : '—'}
                </Text>
                <Text style={styles.statHint}>
                  {worldLeaderAttempt
                    ? `Attempt #${worldLeaderAttempt.id}`
                    : 'Verified results only'}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.officialLine}>✓ Official RankSeal challenge</Text>
              <Text style={styles.bodyText}>
                Official attempts are recorded and verified before entering the leaderboard.
              </Text>

              {cooldownChecking568 ? (
                <View style={styles.cooldownCheckingCard}>
                  <Text style={styles.cooldownCheckingLabel}>CHECKING COOLDOWN…</Text>
                  <Text style={styles.cooldownCheckingText}>
                    RankSeal is checking the server before enabling another official 568 attempt.
                  </Text>
                </View>
              ) : cooldownError568 ? (
                <View style={styles.cooldownErrorCard}>
                  <Text style={styles.cooldownErrorLabel}>
                    COOLDOWN CHECK UNAVAILABLE
                  </Text>
                  <Text style={styles.cooldownErrorText}>{cooldownError568}</Text>
                  <Pressable
                    style={styles.cooldownRetryButton}
                    onPress={restore568Cooldown}
                  >
                    <Text style={styles.cooldownRetryButtonText}>TRY AGAIN</Text>
                  </Pressable>
                </View>
              ) : is568CooldownActive ? (
                <View style={styles.cooldownActiveCard}>
                  <Text style={styles.cooldownActiveLabel}>COOLDOWN ACTIVE</Text>
                  <Text style={styles.cooldownActiveTime}>
                    {formatCooldown(cooldownRemaining568)}
                  </Text>
                  <Text style={styles.cooldownActiveText}>
                    Your next official 568 attempt unlocks when this timer reaches zero.
                  </Text>
                  <Text style={styles.cooldownPersistentText}>
                    This cooldown is saved to RankSeal and remains active if the app is closed or reloaded.
                  </Text>
                </View>
              ) : (
                <Pressable
                  style={styles.primary}
                  onPress={() => {
                    setRulesAccepted(false);
                    setScreen('rules');
                  }}
                >
                  <Text style={styles.primaryText}>START OFFICIAL ATTEMPT</Text>
                </Pressable>
              )}

              <Pressable style={[styles.secondary, styles.disabledButton]} disabled>
                <Text style={styles.secondaryText}>PRACTICE — COMING SOON</Text>
              </Pressable>
            </View>

            <View style={styles.twoButtonRow}>
              <Pressable
                style={[styles.secondary, styles.halfButton]}
                onPress={() => setScreen('leaderboard')}
              >
                <Text style={styles.secondaryTextSmall}>VIEW LEADERBOARD</Text>
              </Pressable>
              <Pressable
                style={[styles.secondary, styles.halfButton]}
                onPress={() => { setRulesAccepted(false); setScreen('rules'); }}
              >
                <Text style={styles.secondaryTextSmall}>VIEW RULES</Text>
              </Pressable>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>What makes it official?</Text>
              <Text style={styles.bodyText}>
                Your attempt must follow the challenge rules and pass RankSeal verification before it receives a ranking.
              </Text>
            </View>

            <View style={styles.cooldownInfoCard}>
              <Text style={styles.infoTitle}>Why is there a cooldown?</Text>
              <Text style={styles.bodyText}>
                The 568 involves drinking a full 568 ml of water quickly. To discourage repeated rapid attempts in a short period, RankSeal requires a cooldown before another official 568 attempt can begin.
              </Text>
              <Text style={styles.cooldownInfoSmall}>
                The cooldown starts at GO and still applies if you discard the attempt or it is not verified. It is saved to RankSeal, so closing or reloading the app does not reset it.
              </Text>
              <Text style={styles.cooldownInfoSmall}>
                Cooldowns are challenge-specific. Other RankSeal challenges may have no cooldown at all.
              </Text>
              <Text style={styles.cooldownPrototypeNote}>
                Prototype test: 1-minute cooldown. The launch duration is still to be decided.
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'rules') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.screenScroll}
          contentContainerStyle={styles.rulesScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => setScreen('challenge568')} style={styles.backButton}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>

          <Text style={styles.eyebrow}>THE 568 CHALLENGE</Text>
          <Text style={styles.rulesTitle}>Official 568 Rules</Text>
          <Text style={styles.rulesIntro}>
            Follow these rules for your attempt to be eligible for the verified leaderboard.
          </Text>

          <View style={styles.rulesSection}>
            <Text style={styles.rulesSectionTitle}>Before you start</Text>
            <Text style={styles.rulesItem}>• Use exactly 568 ml of water.</Text>
            <Text style={styles.rulesItem}>• Use a suitable transparent glass or cup.</Text>
            <Text style={styles.rulesItem}>• Place the glass flat on a level surface.</Text>
            <Text style={styles.rulesItem}>• Keep yourself, the glass and the surface visible.</Text>
          </View>

          <View style={styles.rulesSection}>
            <Text style={styles.rulesSectionTitle}>During the attempt</Text>
            <Text style={styles.rulesItem}>• Do not begin drinking before GO.</Text>
            <Text style={styles.rulesItem}>• Drink the full 568 ml.</Text>
            <Text style={styles.rulesItem}>• Recording must remain continuous.</Text>
            <Text style={styles.rulesItem}>• Press STOP when you have finished drinking.</Text>
          </View>

          <View style={styles.rulesSection}>
            <Text style={styles.rulesSectionTitle}>To finish</Text>
            <Text style={styles.rulesItem}>• Recording continues after STOP.</Text>
            <Text style={styles.rulesItem}>• Turn the glass upside down when instructed.</Text>
            <Text style={styles.rulesItem}>• Small residual drops are allowed.</Text>
            <Text style={styles.rulesItem}>• Your result only becomes official after verification.</Text>
          </View>

          <View style={[styles.rulesSection, styles.cooldownRulesSection]}>
            <Text style={styles.rulesSectionTitle}>Cooldown after an attempt</Text>

            <View style={styles.cooldownWhyBox}>
              <Text style={styles.cooldownWhyLabel}>WHY THIS COOLDOWN EXISTS</Text>
              <Text style={styles.cooldownWhyText}>
                The 568 involves drinking a full 568 ml of water quickly. The cooldown is a safety measure designed to discourage repeated rapid water-drinking attempts in a short period.
              </Text>
            </View>

            <Text style={styles.rulesItem}>
              • The 568 cooldown begins at GO, not when you submit your result.
            </Text>
            <Text style={styles.rulesItem}>
              • It still applies if you discard the attempt or the attempt is not verified.
            </Text>
            <Text style={styles.rulesItem}>
              • You cannot begin another official 568 attempt until the cooldown ends.
            </Text>
            <Text style={styles.rulesItem}>
              • The cooldown is saved to RankSeal and does not reset if you close or reload the app.
            </Text>
            <Text style={styles.rulesItem}>
              • Cooldowns are challenge-specific; other RankSeal challenges may have no cooldown.
            </Text>
            <Text style={styles.cooldownRulesPrototype}>
              Prototype test duration: 1 minute. The production duration has not been set yet.
            </Text>
          </View>

          <Pressable
            style={styles.confirmationCard}
            onPress={() => setRulesAccepted(!rulesAccepted)}
          >
            <View style={[styles.checkboxBox, rulesAccepted && styles.checkboxBoxChecked]}>
              {rulesAccepted ? <Text style={styles.checkboxTick}>✓</Text> : null}
            </View>
            <Text style={styles.confirmationText}>
              I understand the official rules and want to start an official attempt.
            </Text>
          </Pressable>

          {cooldownChecking568 ? (
            <View style={styles.rulesCooldownLock}>
              <Text style={styles.rulesCooldownLockLabel}>CHECKING COOLDOWN…</Text>
              <Text style={styles.rulesCooldownLockText}>
                RankSeal is checking the server before camera setup can be enabled.
              </Text>
            </View>
          ) : cooldownError568 ? (
            <View style={styles.rulesCooldownLock}>
              <Text style={styles.rulesCooldownLockLabel}>
                COOLDOWN CHECK UNAVAILABLE
              </Text>
              <Text style={styles.rulesCooldownLockText}>{cooldownError568}</Text>
              <Pressable
                style={styles.rulesCooldownRetryButton}
                onPress={restore568Cooldown}
              >
                <Text style={styles.rulesCooldownRetryButtonText}>TRY AGAIN</Text>
              </Pressable>
            </View>
          ) : is568CooldownActive ? (
            <View style={styles.rulesCooldownLock}>
              <Text style={styles.rulesCooldownLockLabel}>COOLDOWN ACTIVE</Text>
              <Text style={styles.rulesCooldownLockTime}>
                {formatCooldown(cooldownRemaining568)}
              </Text>
              <Text style={styles.rulesCooldownLockText}>
                Camera setup will unlock when the cooldown ends.
              </Text>
              <Text style={styles.rulesCooldownPersistentText}>
                Closing or reloading the app does not reset this cooldown.
              </Text>
            </View>
          ) : (
            <Pressable
              style={[styles.rulesPrimary, !rulesAccepted && styles.primaryDisabled]}
              onPress={openCamera}
              disabled={!rulesAccepted}
            >
              <Text style={styles.rulesPrimaryText}>CONTINUE TO CAMERA SETUP</Text>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'camera') {
    if (!permission) {
      return (
        <View style={styles.permissionScreen}>
          <Text style={styles.title}>Loading camera…</Text>
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <SafeAreaView style={styles.safe}>
          <View style={styles.permissionScreen}>
            <Text style={styles.eyebrow}>CAMERA ACCESS</Text>
            <Text style={styles.title}>Camera permission needed</Text>
            <Text style={styles.bodyText}>
              The 568 Challenge needs camera access so an attempt can be recorded and reviewed.
            </Text>

            <Pressable style={styles.primary} onPress={requestPermission}>
              <Text style={styles.primaryText}>ALLOW CAMERA</Text>
            </Pressable>

            <Pressable style={styles.secondary} onPress={() => setScreen('rules')}>
              <Text style={styles.secondaryText}>BACK</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <View style={styles.cameraScreen}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={cameraFacing}
          mode="video"
          mute={true}
          mirror={cameraFacing === 'front'}
          onCameraReady={() => setCameraReady(true)}
        />

        <SafeAreaView style={styles.cameraOverlay}>
          {phase === 'setup' && (
            <View style={styles.cameraSetupLayout}>
              <View style={styles.cameraSetupTop}>
                <Pressable
                  style={styles.cameraBackButton}
                  onPress={() => setScreen('rules')}
                >
                  <Text style={styles.cameraBackText}>‹ Back</Text>
                </Pressable>

                <View style={styles.cameraSetupHeaderCard}>
                  <Text style={styles.cameraSetupEyebrow}>OFFICIAL 568 ATTEMPT</Text>
                  <Text style={styles.cameraSetupTitle}>Set up your camera</Text>
                  <Text style={styles.cameraSetupIntro}>
                    Keep your upper body, the full glass and the surface underneath it visible.
                  </Text>
                </View>
              </View>

              <View style={styles.cameraGuide}>
                <Pressable
                  style={styles.cameraSwitchButton}
                  onPress={() => {
                    setCameraReady(false);
                    setCameraSetupConfirmed(false);
                    setCameraFacing((current) => (current === 'front' ? 'back' : 'front'));
                  }}
                >
                  <Text style={styles.cameraSwitchText}>
                    {cameraFacing === 'front' ? '↻ USE REAR CAMERA' : '↻ USE SELFIE CAMERA'}
                  </Text>
                </Pressable>

                <Text style={styles.cameraGuideText}>KEEP YOURSELF + GLASS + SURFACE IN FRAME</Text>
              </View>

              <View style={styles.cameraSetupBottom}>
                <View style={styles.cameraChecklistCard}>
                  <Text style={styles.cameraChecklistTitle}>Before continuing, make sure:</Text>

                  <View style={styles.cameraChecklistGrid}>
                    <View style={styles.cameraChecklistColumn}>
                      <Text style={styles.cameraChecklistItem}>○ You are visible</Text>
                      <Text style={styles.cameraChecklistItem}>○ Full glass visible</Text>
                      <Text style={styles.cameraChecklistItem}>○ Surface visible</Text>
                    </View>
                    <View style={styles.cameraChecklistColumn}>
                      <Text style={styles.cameraChecklistItem}>○ Camera unobstructed</Text>
                      <Text style={styles.cameraChecklistItem}>○ Phone stable</Text>
                    </View>
                  </View>

                  <Pressable
                    style={styles.cameraConfirmationRow}
                    onPress={() => setCameraSetupConfirmed(!cameraSetupConfirmed)}
                  >
                    <View
                      style={[
                        styles.cameraCheckbox,
                        cameraSetupConfirmed && styles.cameraCheckboxChecked,
                      ]}
                    >
                      {cameraSetupConfirmed ? (
                        <Text style={styles.cameraCheckboxTick}>✓</Text>
                      ) : null}
                    </View>
                    <Text style={styles.cameraConfirmationText}>
                      My camera is positioned correctly.
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.cameraContinueButton,
                      (!cameraReady || !cameraSetupConfirmed) && styles.cameraContinueDisabled,
                    ]}
                    disabled={!cameraReady || !cameraSetupConfirmed}
                    onPress={() => { setPrecheckConfirmed(false); setPhase('precheck'); }}
                  >
                    <Text style={styles.cameraContinueText}>
                      {cameraReady ? 'CONTINUE' : 'CAMERA LOADING…'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {phase === 'precheck' && (
            <View style={styles.precheckLayout}>
              <View style={styles.precheckTop}>
                <Pressable
                  style={styles.precheckBackButton}
                  onPress={() => setPhase('setup')}
                >
                  <Text style={styles.precheckBackText}>‹ Back</Text>
                </Pressable>

                <View style={styles.precheckHeaderCard}>
                  <Text style={styles.precheckEyebrow}>OFFICIAL 568 ATTEMPT</Text>
                  <Text style={styles.precheckTitle}>Before you start</Text>
                  <Text style={styles.precheckIntro}>
                    Check the starting position carefully before beginning the countdown.
                  </Text>
                </View>
              </View>

              <View style={styles.precheckFrame}>
                <Text style={styles.precheckFrameText}>KEEP THE FULL GLASS + YOURSELF IN FRAME</Text>
              </View>

              <View style={styles.precheckBottom}>
                <View style={styles.precheckCard}>
                  <Text style={styles.precheckCardTitle}>Starting-position checklist</Text>
                  <Text style={styles.precheckItem}>○ Glass contains exactly 568 ml of water</Text>
                  <Text style={styles.precheckItem}>○ Glass is upright</Text>
                  <Text style={styles.precheckItem}>○ Glass is flat on a level surface</Text>
                  <Text style={styles.precheckItem}>○ Full glass is clearly visible</Text>
                  <Text style={styles.precheckItem}>○ You are clearly visible</Text>
                  <Text style={styles.precheckItem}>○ Nothing obstructs the camera</Text>

                  <Pressable
                    style={styles.precheckConfirmationRow}
                    onPress={() => setPrecheckConfirmed(!precheckConfirmed)}
                  >
                    <View
                      style={[
                        styles.precheckCheckbox,
                        precheckConfirmed && styles.precheckCheckboxChecked,
                      ]}
                    >
                      {precheckConfirmed ? (
                        <Text style={styles.precheckCheckboxTick}>✓</Text>
                      ) : null}
                    </View>
                    <Text style={styles.precheckConfirmationText}>
                      Everything is set up correctly.
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.precheckContinueButton,
                      !precheckConfirmed && styles.precheckContinueDisabled,
                    ]}
                    disabled={!precheckConfirmed}
                    onPress={() => setPhase('ready')}
                  >
                    <Text style={styles.precheckContinueText}>READY FOR OFFICIAL ATTEMPT</Text>
                  </Pressable>

                  <Text style={styles.precheckNote}>
                    These conditions will also be checked during verification.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {phase === 'ready' && (
            <View style={styles.readyLayout}>
              <View style={styles.readyTop}>
                <Pressable
                  style={styles.readyBackButton}
                  onPress={() => {
                    setPrecheckConfirmed(false);
                    setPhase('precheck');
                  }}
                >
                  <Text style={styles.readyBackText}>‹ Back</Text>
                </Pressable>
              </View>

              <View style={styles.readyCenter}>
                <View style={styles.readyCard}>
                  <Text style={styles.readyEyebrow}>OFFICIAL 568 ATTEMPT</Text>
                  <Text style={styles.readyTitle}>GET READY</Text>
                  <Text style={styles.readyIntro}>
                    Recording begins when you tap START.
                  </Text>
                  <Text style={styles.readyWarning}>
                    Do not start drinking until GO.
                  </Text>
                </View>
              </View>

              <View style={styles.readyBottom}>
                <Text style={styles.readySequence}>3  •  2  •  1  •  GO</Text>
                <Pressable
                  style={[
                    styles.readyStartButton,
                    !cameraReady && styles.disabledButton,
                  ]}
                  disabled={!cameraReady}
                  onPress={startCountdown}
                >
                  <Text style={styles.readyStartText}>
                    {cameraReady ? 'START' : 'CAMERA LOADING…'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {phase === 'countdown' && (
            <View style={styles.countdownLayout}>
              <View style={styles.recordingPill}>
                <Text style={styles.recordingPillText}>● RECORDING</Text>
              </View>

              <View style={styles.countdownCenter}>
                <Text style={styles.countdownNumber}>
                  {countdown > 0 ? countdown : 'GO!'}
                </Text>
                <Text style={styles.countdownHelp}>
                  {countdown > 0 ? 'DO NOT START YET' : 'GO'}
                </Text>
              </View>
            </View>
          )}

          {phase === 'drinking' && (
            <View style={styles.liveAttemptLayout}>
              <View style={styles.liveRecordingPill}>
                <Text style={styles.recordingPillText}>● RECORDING</Text>
              </View>

              <View style={styles.cameraCenter}>
                <Text style={styles.go}>GO!</Text>
                <Text style={styles.liveTime}>{formatTime(elapsed)}</Text>
                <Text style={styles.secondsLight}>SECONDS</Text>
              </View>

              <View style={styles.cameraBottom}>
                <Pressable style={styles.stopButton} onPress={stopAttempt}>
                  <Text style={styles.stopButtonText}>STOP</Text>
                </Pressable>
              </View>
            </View>
          )}

          {phase === 'flip' && (
            <View style={styles.finishVerificationLayout}>
              <View style={styles.liveRecordingPill}>
                <Text style={styles.recordingPillText}>● RECORDING</Text>
              </View>

              <View style={styles.finishVerificationTopCard}>
                <Text style={styles.finishStoppedLabel}>TIME STOPPED</Text>
                <Text style={styles.finishFrozenTime}>{formatTime(finalTime)}</Text>
                <Text style={styles.finishSeconds}>SECONDS</Text>
              </View>

              <View style={styles.finishGuide}>
                <Text style={styles.finishGuideTitle}>TURN THE GLASS UPSIDE DOWN</Text>
                <Text style={styles.finishGuideText}>
                  Hold the full glass inverted where the camera can clearly see it.
                </Text>

                <View style={styles.finishInstructionPill}>
                  <Text style={styles.finishInstructionText}>
                    KEEP THE GLASS UPSIDE DOWN + IN FRAME
                  </Text>
                </View>
              </View>

              <View style={styles.finishVerificationBottom}>
                <View style={styles.finishVerificationCard}>
                  <Text style={styles.finishChecklistItem}>✓ Competitive time has stopped</Text>
                  <Text style={styles.finishChecklistItem}>● Recording is still running</Text>
                  <Text style={styles.finishChecklistItem}>✓ Small residual drops are allowed</Text>

                  <Pressable
                    style={[
                      styles.finishRecordingButton,
                      !flipHoldReady && styles.finishRecordingButtonDisabled,
                    ]}
                    onPress={finishRecording}
                    disabled={!flipHoldReady}
                  >
                    <Text style={styles.finishRecordingButtonText}>
                      {flipHoldReady ? 'FINISH RECORDING' : 'HOLD GLASS IN VIEW…'}
                    </Text>
                  </Pressable>

                  <Text style={styles.finishVerificationNote}>
                    Keep the glass visible until recording has finished.
                  </Text>
                </View>
              </View>
            </View>
          )}
        </SafeAreaView>
      </View>
    );
  }

  if (screen === 'result') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.screenScroll}
          contentContainerStyle={styles.resultScreenContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.resultHeader}>
            <Text style={styles.resultChallenge}>THE 568 CHALLENGE</Text>
            <Text style={styles.resultYourTime}>YOUR TIME</Text>
            <Text style={styles.resultTimeLarge}>{formatTime(finalTime)}</Text>
            <Text style={styles.resultSecondsLabel}>SECONDS</Text>
          </View>

          <View style={styles.unofficialBadge}>
            <Text style={styles.unofficialBadgeText}>UNOFFICIAL RESULT</Text>
          </View>

          <Text style={styles.unofficialExplanation}>
            Your attempt has been recorded, but it has not entered the RankSeal leaderboard yet.
          </Text>

          <View style={styles.resultStatusCard}>
            <Text style={styles.resultStatusTitle}>What happens next?</Text>

            <View style={styles.resultStepRow}>
              <Text style={styles.resultStepNumber}>1</Text>
              <Text style={styles.resultStepText}>
                Your recorded attempt is checked against the official 568 rules.
              </Text>
            </View>

            <View style={styles.resultStepRow}>
              <Text style={styles.resultStepNumber}>2</Text>
              <Text style={styles.resultStepText}>
                The attempt is approved, rejected with a reason, or sent for further review.
              </Text>
            </View>

            <View style={styles.resultStepRow}>
              <Text style={styles.resultStepNumber}>3</Text>
              <Text style={styles.resultStepText}>
                Only verified results receive an official RankSeal ranking.
              </Text>
            </View>
          </View>

          {!videoUri ? (
            <View style={styles.resultWarningCard}>
              <Text style={styles.resultWarningTitle}>Recording could not be confirmed</Text>
              <Text style={styles.resultWarningText}>
                This attempt cannot be submitted for verification. Please try again.
              </Text>
            </View>
          ) : null}

          {submitError ? (
            <Text style={styles.resultSubmitError}>{submitError}</Text>
          ) : null}

          {submittingAttempt && uploadProgressText ? (
            <View style={styles.uploadProgressCard}>
              <Text style={styles.uploadProgressLabel}>SUBMITTING ATTEMPT</Text>
              <Text style={styles.uploadProgressText}>{uploadProgressText}</Text>
              <Text style={styles.uploadProgressHint}>
                Keep RankSeal open until the upload finishes.
              </Text>
            </View>
          ) : null}

          <Pressable
            style={[
              styles.resultSubmitButton,
              (!videoUri || submittingAttempt) && styles.resultSubmitButtonDisabled,
            ]}
            onPress={submitAttempt}
            disabled={!videoUri || submittingAttempt}
          >
            <Text style={styles.resultSubmitButtonText}>
              {submittingAttempt
                ? (uploadProgressText || 'SUBMITTING…').toUpperCase()
                : 'SUBMIT FOR VERIFICATION'}
            </Text>
          </Pressable>

          <Pressable
            style={styles.resultDiscardButton}
            onPress={() => {
              resetAttempt();
              setScreen('home');
            }}
            disabled={submittingAttempt}
          >
            <Text style={styles.resultDiscardText}>DISCARD ATTEMPT</Text>
          </Pressable>

          <Text style={styles.resultFootnote}>
            Your time remains unofficial until verification is complete.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'pending') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.screenScroll}
          contentContainerStyle={styles.pendingScreenContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pendingHero}>
            <View style={styles.pendingTickCircle}>
              <Text style={styles.pendingTickMark}>✓</Text>
            </View>

            <Text style={styles.pendingEyebrow}>THE 568 CHALLENGE</Text>
            <Text style={styles.pendingTitleLarge}>ATTEMPT SUBMITTED</Text>
            <Text style={styles.pendingSubmittedTime}>{formatTime(activeAttemptTime)}</Text>
            <Text style={styles.pendingSecondsLabel}>SECONDS</Text>
          </View>

          <View style={styles.pendingStatusCard}>
            <Text style={styles.pendingStatusLabel}>STATUS</Text>
            <Text style={styles.pendingStatusValue}>PENDING VERIFICATION</Text>
            <Text style={styles.pendingStatusText}>
              Your attempt has been received and is waiting to be checked.
            </Text>
          </View>

          <View style={styles.pendingInfoCard}>
            <Text style={styles.pendingInfoTitle}>What happens next?</Text>

            <View style={styles.pendingInfoRow}>
              <Text style={styles.pendingInfoDot}>1</Text>
              <Text style={styles.pendingInfoText}>
                Your recording is checked against the official 568 rules.
              </Text>
            </View>

            <View style={styles.pendingInfoRow}>
              <Text style={styles.pendingInfoDot}>2</Text>
              <Text style={styles.pendingInfoText}>
                If approved, your result becomes verified and enters the official leaderboard.
              </Text>
            </View>

            <View style={styles.pendingInfoRow}>
              <Text style={styles.pendingInfoDot}>3</Text>
              <Text style={styles.pendingInfoText}>
                If it cannot be verified, you’ll see the reason and can try again.
              </Text>
            </View>
          </View>

          <Pressable
            style={styles.pendingPrimaryButton}
            onPress={() => setScreen('attempts')}
          >
            <Text style={styles.pendingPrimaryButtonText}>VIEW MY ATTEMPTS</Text>
          </Pressable>

          <Pressable
            style={styles.pendingSecondaryButton}
            onPress={() => setScreen('home')}
          >
            <Text style={styles.pendingSecondaryButtonText}>BACK TO HOME</Text>
          </Pressable>

          <Text style={styles.pendingFootnote}>
            Only verified attempts receive an official RankSeal ranking.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'attempts') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.screenScroll}
          contentContainerStyle={styles.attemptsScreenContent}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => {
              setSelectedAttempt(null);
              setScreen('home');
            }}
            style={styles.backButton}
          >
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>

          <View style={styles.attemptsHeaderRow}>
            <View style={styles.attemptsHeaderCopy}>
              <Text style={styles.attemptsEyebrow}>RANKSEAL</Text>
              <Text style={styles.attemptsTitle}>My Attempts</Text>
            </View>

            <Pressable
              style={styles.attemptsRefreshButton}
              onPress={fetchAttempts}
              disabled={attemptsLoading}
            >
              <Text style={styles.attemptsRefreshText}>
                {attemptsLoading ? 'LOADING…' : 'REFRESH'}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.attemptsIntro}>
            Submitted challenge attempts and their real verification status.
          </Text>

          {attemptsLoading && attempts.length === 0 ? (
            <View style={styles.attemptsMessageCard}>
              <Text style={styles.attemptsMessageTitle}>Loading attempts…</Text>
              <Text style={styles.attemptsMessageText}>
                Checking your Supabase attempts table.
              </Text>
            </View>
          ) : null}

          {attemptsError ? (
            <View style={styles.attemptsErrorCard}>
              <Text style={styles.attemptsErrorTitle}>Could not load attempts</Text>
              <Text style={styles.attemptsErrorText}>{attemptsError}</Text>
              <Pressable style={styles.attemptsRetryButton} onPress={fetchAttempts}>
                <Text style={styles.attemptsRetryText}>TRY AGAIN</Text>
              </Pressable>
            </View>
          ) : null}

          {!attemptsLoading && !attemptsError && attempts.length === 0 ? (
            <View style={styles.attemptsMessageCard}>
              <Text style={styles.attemptsMessageTitle}>No attempts yet</Text>
              <Text style={styles.attemptsMessageText}>
                Complete an official 568 attempt and submit it for verification.
              </Text>
            </View>
          ) : null}

          {attempts.map((attempt) => {
            const verified = attempt.status === 'verified';
            const rejected = attempt.status === 'rejected';

            return (
              <Pressable
                key={attempt.id}
                style={styles.attemptCard}
                onPress={() => openAttempt(attempt)}
              >
                <View style={styles.attemptCardTopRow}>
                  <View style={styles.attemptCardMain}>
                    <Text style={styles.attemptChallenge}>THE 568 CHALLENGE</Text>
                    <Text style={styles.attemptTime}>{formatTime(attempt.time_ms)} sec</Text>
                    <Text style={styles.attemptId}>ATTEMPT #{attempt.id}</Text>
                  </View>

                  <View
                    style={[
                      styles.attemptStatusBadge,
                      verified && styles.attemptVerifiedBadge,
                      rejected && styles.attemptRejectedBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.attemptStatusBadgeText,
                        verified && styles.attemptVerifiedBadgeText,
                      ]}
                    >
                      {getAttemptStatusLabel(attempt.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.attemptDivider} />

                <Text style={styles.attemptStatusLabel}>VERIFICATION STATUS</Text>
                <Text style={styles.attemptStatusValue}>
                  {getAttemptStatusTitle(attempt.status)}
                </Text>
                <Text style={styles.attemptStatusText}>
                  {getAttemptStatusText(attempt)}
                </Text>

                <Text style={styles.attemptOpenHint}>
                  {attempt.status === 'pending'
                    ? 'TAP TO VIEW STATUS'
                    : 'TAP TO VIEW RESULT'}{' '}
                  →
                </Text>
              </Pressable>
            );
          })}

          <View style={styles.reviewAccessCard}>
            <Text style={styles.reviewAccessLabel}>PROTOTYPE ADMIN</Text>
            <Text style={styles.reviewAccessText}>
              Review pending attempts without editing raw Supabase cells.
            </Text>
            <Pressable
              style={styles.reviewAccessButton}
              onPress={() => setScreen('reviewQueue')}
            >
              <Text style={styles.reviewAccessButtonText}>OPEN REVIEW QUEUE</Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.pendingSecondaryButton}
            onPress={() => {
              setSelectedAttempt(null);
              setScreen('home');
            }}
          >
            <Text style={styles.pendingSecondaryButtonText}>BACK TO HOME</Text>
          </Pressable>

          <Text style={styles.attemptsPrototypeNote}>
            Prototype: these rows currently represent the shared Supabase attempts table.
            User accounts come later.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'reviewQueue') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.screenScroll}
          contentContainerStyle={styles.reviewScreenContent}
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => setScreen('attempts')} style={styles.backButton}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>

          <Text style={styles.reviewEyebrow}>PROTOTYPE ADMIN</Text>
          <Text style={styles.reviewTitle}>Review Queue</Text>
          <Text style={styles.reviewIntro}>
            Pending 568 attempts waiting for a manual decision.
          </Text>

          <View style={styles.reviewWarningCard}>
            <Text style={styles.reviewWarningTitle}>Prototype reviewer</Text>
            <Text style={styles.reviewWarningText}>
              This admin screen is only for development testing. Real reviewer authentication and video playback will be added later.
            </Text>
          </View>

          {reviewQueueNotice ? (
            <View style={styles.reviewSuccessCard}>
              <Text style={styles.reviewSuccessTitle}>✓ REVIEW SAVED</Text>
              <Text style={styles.reviewSuccessText}>{reviewQueueNotice}</Text>
            </View>
          ) : null}

          {attemptsLoading && pendingReviewAttempts.length === 0 ? (
            <View style={styles.reviewEmptyCard}>
              <Text style={styles.reviewEmptyTitle}>Loading review queue…</Text>
            </View>
          ) : null}

          {!attemptsLoading && pendingReviewAttempts.length === 0 ? (
            <View style={styles.reviewEmptyCard}>
              <Text style={styles.reviewEmptyTitle}>No pending attempts</Text>
              <Text style={styles.reviewEmptyText}>
                New submitted attempts will appear here automatically.
              </Text>
            </View>
          ) : null}

          {pendingReviewAttempts.map((attempt) => (
            <Pressable
              key={attempt.id}
              style={styles.reviewQueueCard}
              onPress={() => openReviewAttempt(attempt)}
            >
              <View style={styles.reviewQueueTopRow}>
                <View>
                  <Text style={styles.reviewQueueChallenge}>THE 568 CHALLENGE</Text>
                  <Text style={styles.reviewQueueTime}>
                    {formatTime(attempt.time_ms)} sec
                  </Text>
                  <Text style={styles.reviewQueueId}>ATTEMPT #{attempt.id}</Text>
                </View>

                <View style={styles.reviewPendingBadge}>
                  <Text style={styles.reviewPendingBadgeText}>PENDING</Text>
                </View>
              </View>

              <Text style={styles.reviewQueueHint}>TAP TO REVIEW →</Text>
            </Pressable>
          ))}

          <Pressable
            style={styles.reviewRefreshButton}
            onPress={fetchAttempts}
            disabled={attemptsLoading}
          >
            <Text style={styles.reviewRefreshButtonText}>
              {attemptsLoading ? 'REFRESHING…' : 'REFRESH QUEUE'}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'reviewDetail') {
    if (!reviewAttempt) {
      return (
        <SafeAreaView style={styles.safe}>
          <View style={styles.reviewScreenContent}>
            <Text style={styles.reviewEmptyTitle}>No attempt selected.</Text>
            <Pressable
              style={styles.reviewRefreshButton}
              onPress={() => setScreen('reviewQueue')}
            >
              <Text style={styles.reviewRefreshButtonText}>BACK TO REVIEW QUEUE</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.screenScroll}
          contentContainerStyle={styles.reviewScreenContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => {
              setReviewAttempt(null);
              setReviewReasonInput('');
              setReviewMessage('');
              setReviewVideoUrl('');
              setReviewVideoError('');
              setReviewVideoLoading(false);
              setScreen('reviewQueue');
            }}
            style={styles.backButton}
          >
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>

          <Text style={styles.reviewEyebrow}>MANUAL REVIEW</Text>
          <Text style={styles.reviewTitle}>Attempt #{reviewAttempt.id}</Text>

          <View style={styles.reviewAttemptHero}>
            <Text style={styles.reviewAttemptLabel}>RECORDED TIME</Text>
            <Text style={styles.reviewAttemptTime}>
              {formatTime(reviewAttempt.time_ms)}
            </Text>
            <Text style={styles.reviewAttemptSeconds}>SECONDS</Text>
          </View>

          <View style={styles.reviewVideoCard}>
            <View style={styles.reviewVideoHeaderRow}>
              <View>
                <Text style={styles.reviewVideoLabel}>RECORDED ATTEMPT</Text>
                <Text style={styles.reviewVideoPath}>
                  {reviewAttempt.video_path || 'No video path'}
                </Text>
              </View>

              <Pressable
                style={styles.reviewVideoReloadButton}
                onPress={() => loadReviewVideo(reviewAttempt)}
                disabled={reviewVideoLoading}
              >
                <Text style={styles.reviewVideoReloadText}>
                  {reviewVideoLoading ? 'LOADING…' : 'RELOAD'}
                </Text>
              </Pressable>
            </View>

            {reviewVideoLoading ? (
              <View style={styles.reviewVideoState}>
                <Text style={styles.reviewVideoStateTitle}>Loading video…</Text>
                <Text style={styles.reviewVideoStateText}>
                  Creating a temporary private playback link.
                </Text>
              </View>
            ) : reviewVideoError ? (
              <View style={styles.reviewVideoState}>
                <Text style={styles.reviewVideoStateTitle}>Video unavailable</Text>
                <Text style={styles.reviewVideoStateText}>
                  {reviewVideoError}
                </Text>
              </View>
            ) : reviewVideoUrl ? (
              <ReviewVideoPlayer key={reviewVideoUrl} uri={reviewVideoUrl} />
            ) : (
              <View style={styles.reviewVideoState}>
                <Text style={styles.reviewVideoStateTitle}>Video not loaded</Text>
              </View>
            )}

            <Text style={styles.reviewVideoPrivacyNote}>
              Playback uses a temporary signed URL from the private Supabase Storage bucket.
            </Text>
          </View>

          <View style={styles.reviewChecklistCard}>
            <Text style={styles.reviewChecklistTitle}>Review against the 568 rules</Text>
            <Text style={styles.reviewChecklistItem}>• Starting volume is clearly shown.</Text>
            <Text style={styles.reviewChecklistItem}>• Glass is upright on a level surface.</Text>
            <Text style={styles.reviewChecklistItem}>• Person and full glass remain visible.</Text>
            <Text style={styles.reviewChecklistItem}>• Drinking begins after GO.</Text>
            <Text style={styles.reviewChecklistItem}>• Full 568 ml is consumed.</Text>
            <Text style={styles.reviewChecklistItem}>• Recording remains continuous.</Text>
            <Text style={styles.reviewChecklistItem}>• Glass is inverted and shown clearly at the end.</Text>
          </View>

          <View style={styles.reviewReasonCard}>
            <Text style={styles.reviewReasonLabel}>REJECTION REASON</Text>
            <Text style={styles.reviewReasonHelp}>
              Only required if you reject the attempt.
            </Text>
            <TextInput
              style={styles.reviewReasonInput}
              value={reviewReasonInput}
              onChangeText={setReviewReasonInput}
              placeholder="e.g. Starting volume could not be verified clearly"
              placeholderTextColor="#999"
              multiline
              textAlignVertical="top"
              editable={!reviewSaving}
            />
          </View>

          {reviewMessage ? (
            <View style={styles.reviewMessageCard}>
              <Text style={styles.reviewMessageText}>{reviewMessage}</Text>
            </View>
          ) : null}

          <Text style={styles.reviewSaveInstruction}>
            When you choose a decision, RankSeal will require Supabase to return the updated row before treating it as saved.
          </Text>

          <Pressable
            style={[
              styles.reviewVerifyButton,
              reviewSaving && styles.reviewDecisionDisabled,
            ]}
            disabled={reviewSaving}
            onPress={() => saveReviewDecision('verified')}
          >
            <Text style={styles.reviewVerifyButtonText}>
              {reviewSaving ? 'SAVING…' : '✓ VERIFY ATTEMPT'}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.reviewRejectButton,
              reviewSaving && styles.reviewDecisionDisabled,
            ]}
            disabled={reviewSaving}
            onPress={() => saveReviewDecision('rejected')}
          >
            <Text style={styles.reviewRejectButtonText}>NOT VERIFIED</Text>
          </Pressable>

          <Text style={styles.reviewDecisionNote}>
            The decision is written directly to Supabase and updates My Attempts and the leaderboard.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'verifiedResult') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.screenScroll}
          contentContainerStyle={styles.outcomeScreenContent}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            style={styles.outcomeBackButton}
            onPress={() => setScreen('attempts')}
          >
            <Text style={styles.outcomeBackText}>‹ Back</Text>
          </Pressable>

          <View style={styles.outcomeHero}>
            <View style={styles.verifiedCircle}>
              <Text style={styles.verifiedTick}>✓</Text>
            </View>

            <Text style={styles.outcomeEyebrow}>THE 568 CHALLENGE</Text>
            <Text style={styles.verifiedTitle}>VERIFIED</Text>
            <Text style={styles.outcomeTime}>{formatTime(activeAttemptTime)}</Text>
            <Text style={styles.outcomeSeconds}>SECONDS</Text>
          </View>

          <View style={styles.verifiedStatusCard}>
            <Text style={styles.verifiedStatusTitle}>OFFICIAL RESULT</Text>
            <Text style={styles.verifiedStatusText}>
              Your attempt passed verification and now counts as an official RankSeal result.
            </Text>
          </View>

          <View style={styles.verifiedStatsRow}>
            <View style={styles.verifiedStatCard}>
              <Text style={styles.verifiedStatLabel}>WORLD RANK</Text>
              <Text style={styles.verifiedStatValue}>
                {selectedAttempt && getWorldRank(selectedAttempt.id)
                  ? `#${getWorldRank(selectedAttempt.id)}`
                  : '—'}
              </Text>
              <Text style={styles.verifiedStatHint}>
                {selectedAttempt && getWorldRank(selectedAttempt.id)
                  ? 'Official world ranking'
                  : 'Ranking unavailable'}
              </Text>
            </View>

            <View style={styles.verifiedStatCard}>
              <Text style={styles.verifiedStatLabel}>PERSONAL BEST</Text>
              <Text style={styles.verifiedStatValue}>
                {formatTime(
                  attempts
                    .filter((attempt) => attempt.status === 'verified')
                    .reduce(
                      (best, attempt) =>
                        best === null || attempt.time_ms < best ? attempt.time_ms : best,
                      null
                    ) ?? activeAttemptTime
                )}s
              </Text>
              <Text style={styles.verifiedStatHint}>Verified time</Text>
            </View>
          </View>

          <Pressable
            style={styles.outcomePrimaryButton}
            onPress={() => setScreen('leaderboard')}
          >
            <Text style={styles.outcomePrimaryButtonText}>VIEW LEADERBOARD</Text>
          </Pressable>

          <Pressable
            style={styles.outcomeSecondaryButton}
            onPress={shareVerifiedResult}
          >
            <Text style={styles.outcomeSecondaryButtonText}>SHARE RESULT</Text>
          </Pressable>

          <Pressable
            style={styles.outcomeTextButton}
            onPress={() => setScreen('home')}
          >
            <Text style={styles.outcomeTextButtonText}>BACK TO HOME</Text>
          </Pressable>

          <Text style={styles.outcomeFootnote}>
            Verified results are eligible for official RankSeal rankings.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'notVerified') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.screenScroll}
          contentContainerStyle={styles.outcomeScreenContent}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            style={styles.outcomeBackButton}
            onPress={() => setScreen('attempts')}
          >
            <Text style={styles.outcomeBackText}>‹ Back</Text>
          </Pressable>

          <View style={styles.outcomeHero}>
            <View style={styles.notVerifiedCircle}>
              <Text style={styles.notVerifiedMark}>×</Text>
            </View>

            <Text style={styles.outcomeEyebrow}>THE 568 CHALLENGE</Text>
            <Text style={styles.notVerifiedTitle}>NOT VERIFIED</Text>
            <Text style={styles.outcomeTime}>{formatTime(activeAttemptTime)}</Text>
            <Text style={styles.outcomeSeconds}>SECONDS</Text>
          </View>

          <View style={styles.notVerifiedReasonCard}>
            <Text style={styles.notVerifiedReasonLabel}>REASON</Text>
            <Text style={styles.notVerifiedReasonTitle}>
              {selectedAttempt?.review_reason || 'This attempt could not be verified'}
            </Text>
            <Text style={styles.notVerifiedReasonText}>
              The reviewer’s decision is stored with this attempt in Supabase.
            </Text>
          </View>

          <View style={styles.notVerifiedInfoCard}>
            <Text style={styles.notVerifiedInfoTitle}>What this means</Text>
            <Text style={styles.notVerifiedInfoText}>
              Your recorded time has not been added to the official leaderboard. You can review the rules and try again.
            </Text>
          </View>

          <Pressable
            style={styles.outcomePrimaryButton}
            onPress={() => {
              setRulesAccepted(false);
              setScreen('rules');
            }}
          >
            <Text style={styles.outcomePrimaryButtonText}>TRY AGAIN</Text>
          </Pressable>

          <Pressable
            style={styles.outcomeSecondaryButton}
            onPress={() => {
              setRulesAccepted(false);
              setScreen('rules');
            }}
          >
            <Text style={styles.outcomeSecondaryButtonText}>VIEW RULES</Text>
          </Pressable>

          <Pressable
            style={styles.outcomeTextButton}
            onPress={() => setScreen('home')}
          >
            <Text style={styles.outcomeTextButtonText}>BACK TO HOME</Text>
          </Pressable>

          <Text style={styles.outcomeFootnote}>
            A not-verified attempt does not affect future attempts or rankings.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'leaderboard') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.screenScroll}
          contentContainerStyle={styles.leaderboardScreenContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.leaderboardTopRow}>
            <Pressable onPress={() => setScreen('challenge568')}>
              <Text style={styles.back}>‹ Back</Text>
            </Pressable>

            <Pressable
              style={styles.leaderboardRefreshButton}
              onPress={fetchAttempts}
              disabled={attemptsLoading}
            >
              <Text style={styles.leaderboardRefreshText}>
                {attemptsLoading ? 'LOADING…' : 'REFRESH'}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.eyebrow}>WORLD RANKINGS</Text>
          <Text style={styles.title}>Leaderboard</Text>
          <Text style={styles.leaderboardSubtitle}>
            The 568 Challenge · Fastest verified time
          </Text>

          {attemptsLoading && verifiedAttempts.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.emptyTitle}>Loading verified results…</Text>
              <Text style={styles.bodyText}>
                Checking the official RankSeal results in Supabase.
              </Text>
            </View>
          ) : null}

          {attemptsError ? (
            <View style={styles.card}>
              <Text style={styles.emptyTitle}>Leaderboard unavailable</Text>
              <Text style={styles.bodyText}>{attemptsError}</Text>
              <Pressable style={styles.leaderboardRetryButton} onPress={fetchAttempts}>
                <Text style={styles.leaderboardRetryText}>TRY AGAIN</Text>
              </Pressable>
            </View>
          ) : null}

          {!attemptsLoading &&
          !attemptsError &&
          verifiedAttempts.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.emptyTitle}>No verified attempts yet.</Text>
              <Text style={styles.bodyText}>
                The first approved attempt becomes World #1.
              </Text>
            </View>
          ) : null}

          {!attemptsError &&
            verifiedAttempts.map((attempt, index) => (
              <Pressable
                key={attempt.id}
                style={[
                  styles.leaderboardResultCard,
                  index === 0 && styles.leaderboardFirstCard,
                ]}
                onPress={() => openAttempt(attempt)}
              >
                <View style={styles.leaderboardRankCircle}>
                  <Text style={styles.leaderboardRankNumber}>{index + 1}</Text>
                </View>

                <View style={styles.leaderboardResultMain}>
                  <Text style={styles.leaderboardResultLabel}>
                    {index === 0 ? 'WORLD LEADER' : 'VERIFIED RESULT'}
                  </Text>
                  <Text style={styles.leaderboardResultTime}>
                    {formatTime(attempt.time_ms)} sec
                  </Text>
                  <Text style={styles.leaderboardAttemptId}>
                    ATTEMPT #{attempt.id}
                  </Text>
                </View>

                <View style={styles.leaderboardVerifiedBadge}>
                  <Text style={styles.leaderboardVerifiedBadgeText}>VERIFIED</Text>
                </View>
              </Pressable>
            ))}

          {verifiedAttempts.length > 0 ? (
            <View style={styles.leaderboardFooterCard}>
              <Text style={styles.leaderboardFooterTitle}>
                ✓ Official RankSeal leaderboard
              </Text>
              <Text style={styles.leaderboardFooterText}>
                Only attempts with a verified Supabase status are included here.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.homeContainer}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text style={styles.brand}>RANKSEAL</Text>
          <Text style={styles.brandTagline}>Verified challenges. Real rankings.</Text>

          <View style={[styles.card, styles.featuredCard]}>
            <View style={styles.badgeRow}>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>FEATURED</Text>
              </View>
              <Text style={styles.liveText}>LIVE</Text>
            </View>

            <Text style={styles.homeChallengeTitle}>The 568 Challenge</Text>
            <Text style={styles.homeChallengeDescription}>
              How fast can you drink 568 ml of water?
            </Text>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>MEASUREMENT</Text>
                <Text style={styles.statValueSmall}>Fastest verified time</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>LEADERBOARD</Text>
                <Text style={styles.statValueSmall}>Worldwide</Text>
              </View>
            </View>

            <Text style={styles.officialLine}>✓ Official RankSeal leaderboard</Text>

            <Pressable
              style={styles.primary}
              onPress={() => setScreen('challenge568')}
            >
              <Text style={styles.primaryText}>VIEW CHALLENGE</Text>
            </Pressable>

            <Pressable
              style={styles.homeAttemptsButton}
              onPress={() => setScreen('attempts')}
            >
              <Text style={styles.homeAttemptsButtonText}>MY ATTEMPTS</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionHeading}>More challenges</Text>
          <View style={[styles.card, styles.comingSoonCard]}>
            <View style={styles.badgeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.homeChallengeTitleSmall}>One-Leg Balance</Text>
                <Text style={styles.bodyText}>How long can you stay on one leg?</Text>
              </View>
              <View style={styles.soonBadge}>
                <Text style={styles.soonBadgeText}>COMING SOON</Text>
              </View>
            </View>
            <Text style={styles.measurementLabel}>Longest verified time</Text>
          </View>
        </View>

        <View>
          <View style={styles.bottomNav}>
            <View style={styles.navItemActive}>
              <Text style={styles.navTextActive}>Home</Text>
            </View>
            <Pressable style={styles.navItem} onPress={() => setScreen('challenge568')}>
              <Text style={styles.navText}>Challenges</Text>
            </Pressable>
            <Pressable style={styles.navItem} onPress={() => setScreen('leaderboard')}>
              <Text style={styles.navText}>Rankings</Text>
            </Pressable>
            <View style={[styles.navItem, styles.navItemDisabled]}>
              <Text style={styles.navText}>Profile</Text>
            </View>
          </View>
          <Text style={styles.footer}>Prototype • 18+ • Water only • 568 ml</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F5F4EF',
  },
  container: {
    flex: 1,
    padding: 28,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  the: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 4,
    color: '#111',
  },
  number: {
    fontSize: 110,
    lineHeight: 118,
    fontWeight: '900',
    letterSpacing: -7,
    color: '#111',
  },
  challenge: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 3,
    color: '#111',
  },
  tagline: {
    marginTop: 20,
    fontSize: 20,
    lineHeight: 28,
    color: '#555',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: '#777',
  },
  title: {
    marginTop: 8,
    fontSize: 34,
    fontWeight: '900',
    color: '#111',
  },
  card: {
    marginTop: 28,
    padding: 22,
    borderRadius: 22,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E0D8',
  },
  rulesScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 38,
  },
  rulesTitle: {
    marginTop: 5,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: -0.6,
    color: '#111',
  },
  rulesIntro: {
    marginTop: 8,
    marginBottom: 4,
    fontSize: 15,
    lineHeight: 22,
    color: '#666',
  },
  rulesSection: {
    marginTop: 12,
    paddingHorizontal: 17,
    paddingTop: 16,
    paddingBottom: 8,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E0D8',
  },
  rulesSectionTitle: {
    marginBottom: 10,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    color: '#111',
  },
  rulesItem: {
    fontSize: 15,
    lineHeight: 22,
    color: '#30302E',
    marginBottom: 9,
  },
  confirmationCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#ECEAE3',
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#DDDAD0',
  },
  checkboxBox: {
    width: 25,
    height: 25,
    marginRight: 12,
    marginTop: 1,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#6D6D68',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  checkboxBoxChecked: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  checkboxTick: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
  },
  confirmationText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#222',
    fontWeight: '700',
  },
  rulesPrimary: {
    marginTop: 14,
    paddingVertical: 17,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  rulesPrimaryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  primaryDisabled: {
    opacity: 0.35,
  },
  rule: {
    fontSize: 17,
    lineHeight: 25,
    color: '#222',
    marginBottom: 12,
  },
  bodyText: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 23,
    color: '#666',
  },
  leaderboardScreenContent: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 40,
  },
  leaderboardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  leaderboardRefreshButton: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#D7D4CC',
    backgroundColor: '#FFF',
  },
  leaderboardRefreshText: {
    color: '#555',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  leaderboardSubtitle: {
    marginTop: 7,
    marginBottom: 20,
    color: '#666',
    fontSize: 15,
    lineHeight: 21,
  },
  leaderboardResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E0D8',
  },
  leaderboardFirstCard: {
    borderWidth: 2,
    borderColor: '#111',
  },
  leaderboardRankCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderboardRankNumber: {
    color: '#FFF',
    fontSize: 19,
    fontWeight: '900',
  },
  leaderboardResultMain: {
    flex: 1,
    marginLeft: 13,
    minWidth: 0,
  },
  leaderboardResultLabel: {
    color: '#777',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  leaderboardResultTime: {
    marginTop: 2,
    color: '#111',
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '900',
  },
  leaderboardAttemptId: {
    marginTop: 2,
    color: '#888',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  leaderboardVerifiedBadge: {
    marginLeft: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#ECEAE3',
  },
  leaderboardVerifiedBadgeText: {
    color: '#444',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.65,
  },
  leaderboardFooterCard: {
    marginTop: 8,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#ECEAE3',
    borderWidth: 1,
    borderColor: '#DDDAD0',
  },
  leaderboardFooterTitle: {
    color: '#111',
    fontSize: 14,
    fontWeight: '900',
  },
  leaderboardFooterText: {
    marginTop: 5,
    color: '#666',
    fontSize: 12,
    lineHeight: 17,
  },
  leaderboardRetryButton: {
    marginTop: 12,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  leaderboardRetryText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  emptyTitle: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: '800',
    color: '#111',
  },
  primary: {
    marginTop: 28,
    paddingVertical: 20,
    borderRadius: 18,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  primaryText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  secondary: {
    marginTop: 12,
    paddingVertical: 18,
    borderRadius: 18,
    backgroundColor: '#FFF',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D9D7CF',
  },
  secondaryText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '800',
  },
  footer: {
    marginTop: 18,
    textAlign: 'center',
    color: '#777',
    fontSize: 12,
  },
  back: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  permissionScreen: {
    flex: 1,
    justifyContent: 'center',
    padding: 28,
    backgroundColor: '#F5F4EF',
  },
  cameraScreen: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cameraSetupLayout: {
    flex: 1,
  },
  cameraSetupTop: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  cameraBackButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingLeft: 44,
    paddingRight: 12,
  },
  cameraBackText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  cameraSetupHeaderCard: {
    marginTop: 2,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 9,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  cameraSetupEyebrow: {
    color: '#D8D8D8',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  cameraSetupTitle: {
    marginTop: 2,
    color: '#FFF',
    fontSize: 19,
    lineHeight: 22,
    fontWeight: '900',
  },
  cameraSetupIntro: {
    marginTop: 3,
    color: '#F0F0F0',
    fontSize: 11,
    lineHeight: 15,
  },
  cameraGuide: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 8,
    minHeight: 260,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.86)',
    borderStyle: 'dashed',
    borderRadius: 20,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 7,
  },
  cameraSwitchButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  cameraSwitchText: {
    color: '#FFF',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cameraGuideText: {
    color: '#FFF',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.55,
    backgroundColor: 'rgba(0,0,0,0.58)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 11,
    overflow: 'hidden',
  },
  cameraSetupBottom: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  cameraChecklistCard: {
    paddingHorizontal: 11,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  cameraChecklistTitle: {
    color: '#111',
    fontSize: 12.5,
    fontWeight: '900',
    marginBottom: 4,
  },
  cameraChecklistGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  cameraChecklistColumn: {
    flex: 1,
  },
  cameraChecklistItem: {
    color: '#2B2B2B',
    fontSize: 9.5,
    lineHeight: 13,
  },
  cameraConfirmationRow: {
    marginTop: 5,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#DDD',
    flexDirection: 'row',
    alignItems: 'center',
  },
  cameraCheckbox: {
    width: 19,
    height: 19,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#6D6D68',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    marginRight: 7,
  },
  cameraCheckboxChecked: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  cameraCheckboxTick: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
  },
  cameraConfirmationText: {
    flex: 1,
    color: '#111',
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '700',
  },
  cameraContinueButton: {
    marginTop: 5,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  cameraContinueDisabled: {
    opacity: 0.35,
  },
  cameraContinueText: {
    color: '#FFF',
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  precheckLayout: {
    flex: 1,
  },
  precheckTop: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  precheckBackButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingLeft: 44,
    paddingRight: 12,
  },
  precheckBackText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  precheckHeaderCard: {
    marginTop: 2,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 9,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  precheckEyebrow: {
    color: '#D8D8D8',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  precheckTitle: {
    marginTop: 2,
    color: '#FFF',
    fontSize: 19,
    lineHeight: 22,
    fontWeight: '900',
  },
  precheckIntro: {
    marginTop: 3,
    color: '#F0F0F0',
    fontSize: 11,
    lineHeight: 15,
  },
  precheckFrame: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 8,
    minHeight: 230,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.86)',
    borderStyle: 'dashed',
    borderRadius: 20,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 7,
  },
  precheckFrameText: {
    color: '#FFF',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.55,
    backgroundColor: 'rgba(0,0,0,0.58)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 11,
    overflow: 'hidden',
  },
  precheckBottom: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  precheckCard: {
    paddingHorizontal: 11,
    paddingTop: 9,
    paddingBottom: 8,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  precheckCardTitle: {
    color: '#111',
    fontSize: 12.5,
    fontWeight: '900',
    marginBottom: 4,
  },
  precheckItem: {
    color: '#2B2B2B',
    fontSize: 9.8,
    lineHeight: 13.5,
  },
  precheckConfirmationRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#DDD',
    flexDirection: 'row',
    alignItems: 'center',
  },
  precheckCheckbox: {
    width: 19,
    height: 19,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#6D6D68',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    marginRight: 7,
  },
  precheckCheckboxChecked: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  precheckCheckboxTick: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
  },
  precheckConfirmationText: {
    flex: 1,
    color: '#111',
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '700',
  },
  precheckContinueButton: {
    marginTop: 6,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  precheckContinueDisabled: {
    opacity: 0.35,
  },
  precheckContinueText: {
    color: '#FFF',
    fontSize: 11.8,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  precheckNote: {
    marginTop: 4,
    color: '#666',
    fontSize: 9,
    textAlign: 'center',
  },
  cameraCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  readyLayout: {
    flex: 1,
  },
  readyTop: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  readyBackButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingLeft: 44,
    paddingRight: 12,
  },
  readyBackText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  readyCenter: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  readyCard: {
    paddingHorizontal: 22,
    paddingVertical: 24,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.68)',
    alignItems: 'center',
  },
  readyEyebrow: {
    color: '#D8D8D8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.7,
  },
  readyTitle: {
    marginTop: 10,
    color: '#FFF',
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '900',
    letterSpacing: -1,
  },
  readyIntro: {
    marginTop: 10,
    color: '#FFF',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  readyWarning: {
    marginTop: 8,
    color: '#FFF',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    fontWeight: '800',
  },
  readyBottom: {
    paddingHorizontal: 22,
    paddingBottom: 36,
  },
  readySequence: {
    marginBottom: 10,
    color: '#FFF',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.6,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 6,
  },
  readyStartButton: {
    paddingVertical: 18,
    borderRadius: 18,
    backgroundColor: '#FFF',
    alignItems: 'center',
  },
  readyStartText: {
    color: '#111',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  countdownLayout: {
    flex: 1,
    alignItems: 'center',
  },
  recordingPill: {
    marginTop: 24,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  recordingPillText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  finishVerificationLayout: {
    flex: 1,
  },
  finishVerificationTopCard: {
    marginTop: 14,
    marginHorizontal: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.66)',
    alignItems: 'center',
  },
  finishStoppedLabel: {
    color: '#D8D8D8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  finishFrozenTime: {
    marginTop: 2,
    color: '#FFF',
    fontSize: 38,
    lineHeight: 43,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  finishSeconds: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  finishGuide: {
    flex: 1,
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 10,
    minHeight: 250,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.86)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  finishGuideTitle: {
    color: '#FFF',
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowRadius: 8,
  },
  finishGuideText: {
    marginTop: 9,
    color: '#FFF',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowRadius: 8,
  },
  finishInstructionPill: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  finishInstructionText: {
    color: '#FFF',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  finishVerificationBottom: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  finishVerificationCard: {
    paddingHorizontal: 13,
    paddingTop: 10,
    paddingBottom: 9,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  finishChecklistItem: {
    color: '#222',
    fontSize: 10.5,
    lineHeight: 15,
    fontWeight: '700',
  },
  finishRecordingButton: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 13,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  finishRecordingButtonDisabled: {
    opacity: 0.35,
  },
  finishRecordingButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  finishVerificationNote: {
    marginTop: 5,
    color: '#666',
    fontSize: 9,
    textAlign: 'center',
  },
  liveAttemptLayout: {
    flex: 1,
  },
  liveRecordingPill: {
    alignSelf: 'center',
    marginTop: 22,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  countdownCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 70,
  },
  countdownNumber: {
    textAlign: 'center',
    fontSize: 156,
    lineHeight: 165,
    fontWeight: '900',
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowRadius: 12,
  },
  countdownHelp: {
    marginTop: 8,
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cameraTopCard: {
    margin: 24,
    padding: 18,
    backgroundColor: 'rgba(0,0,0,0.60)',
    borderRadius: 20,
  },
  camera568: {
    color: '#FFF',
    fontSize: 46,
    fontWeight: '900',
  },
  cameraInstruction: {
    marginTop: 8,
    color: '#FFF',
    fontSize: 17,
    lineHeight: 24,
  },
  cameraBottom: {
    padding: 24,
    paddingBottom: 40,
  },
  whiteButton: {
    paddingVertical: 20,
    borderRadius: 18,
    backgroundColor: '#FFF',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  whiteButtonText: {
    color: '#111',
    fontSize: 17,
    fontWeight: '900',
  },
  countdown: {
    textAlign: 'center',
    fontSize: 150,
    fontWeight: '900',
    color: '#FFF',
  },
  go: {
    textAlign: 'center',
    fontSize: 36,
    fontWeight: '900',
    color: '#FFF',
  },
  liveTime: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 86,
    fontWeight: '900',
    letterSpacing: -4,
    color: '#FFF',
  },
  secondsLight: {
    textAlign: 'center',
    fontSize: 18,
    letterSpacing: 3,
    fontWeight: '900',
    color: '#FFF',
  },
  stopButton: {
    paddingVertical: 24,
    borderRadius: 18,
    backgroundColor: '#D92D20',
    alignItems: 'center',
  },
  stopButtonText: {
    color: '#FFF',
    fontSize: 25,
    fontWeight: '900',
  },
  flipCard: {
    margin: 24,
    marginTop: 70,
    padding: 24,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  frozenTime: {
    fontSize: 46,
    fontWeight: '900',
    color: '#FFF',
  },
  flipTitle: {
    marginTop: 24,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
    color: '#FFF',
  },
  resultScreenContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 34,
  },
  resultHeader: {
    alignItems: 'center',
  },
  resultChallenge: {
    color: '#777',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.7,
  },
  resultYourTime: {
    marginTop: 18,
    color: '#777',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  resultTimeLarge: {
    marginTop: 2,
    color: '#111',
    fontSize: 72,
    lineHeight: 78,
    fontWeight: '900',
    letterSpacing: -2,
  },
  resultSecondsLabel: {
    marginTop: -3,
    color: '#111',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  unofficialBadge: {
    alignSelf: 'center',
    marginTop: 22,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 15,
    backgroundColor: '#ECEAE3',
    borderWidth: 1,
    borderColor: '#DDDAD0',
  },
  unofficialBadgeText: {
    color: '#333',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  unofficialExplanation: {
    marginTop: 13,
    paddingHorizontal: 8,
    color: '#666',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  resultStatusCard: {
    marginTop: 20,
    padding: 17,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E0D8',
  },
  resultStatusTitle: {
    marginBottom: 11,
    color: '#111',
    fontSize: 17,
    fontWeight: '900',
  },
  resultStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 11,
  },
  resultStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 10,
    paddingTop: 3,
    backgroundColor: '#111',
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  resultStepText: {
    flex: 1,
    color: '#444',
    fontSize: 13,
    lineHeight: 19,
  },
  resultWarningCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#ECEAE3',
  },
  resultWarningTitle: {
    color: '#111',
    fontSize: 14,
    fontWeight: '900',
  },
  resultWarningText: {
    marginTop: 4,
    color: '#555',
    fontSize: 12,
    lineHeight: 17,
  },
  resultSubmitError: {
    marginTop: 12,
    color: '#8A1C1C',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    fontWeight: '700',
  },
  uploadProgressCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#ECEAE3',
    borderWidth: 1,
    borderColor: '#DDDAD0',
    alignItems: 'center',
  },
  uploadProgressLabel: {
    color: '#777',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  uploadProgressText: {
    marginTop: 5,
    color: '#111',
    fontSize: 15,
    fontWeight: '900',
  },
  uploadProgressHint: {
    marginTop: 4,
    color: '#666',
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
  resultSubmitButton: {
    marginTop: 18,
    paddingVertical: 17,
    borderRadius: 17,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  resultSubmitButtonDisabled: {
    opacity: 0.35,
  },
  resultSubmitButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  resultDiscardButton: {
    marginTop: 9,
    paddingVertical: 13,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#D7D4CC',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  resultDiscardText: {
    color: '#555',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  resultFootnote: {
    marginTop: 11,
    color: '#777',
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
  resultTime: {
    marginTop: 8,
    fontSize: 100,
    lineHeight: 108,
    fontWeight: '900',
    letterSpacing: -5,
    color: '#111',
  },
  secondsDark: {
    fontSize: 18,
    letterSpacing: 3,
    fontWeight: '900',
    color: '#666',
  },
  resultText: {
    marginTop: 18,
    fontSize: 17,
    lineHeight: 24,
    color: '#666',
  },
  outcomePreviewCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 17,
    backgroundColor: '#ECEAE3',
    borderWidth: 1,
    borderColor: '#DDDAD0',
  },
  outcomePreviewLabel: {
    color: '#777',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  outcomePreviewText: {
    marginTop: 4,
    color: '#555',
    fontSize: 11,
    lineHeight: 16,
  },
  outcomePreviewRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  outcomePreviewButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  outcomePreviewButtonText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  outcomeScreenContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 54,
    paddingBottom: 34,
  },
  outcomeBackButton: {
    alignSelf: 'flex-start',
    paddingVertical: 7,
    paddingRight: 18,
    marginBottom: 8,
  },
  outcomeBackText: {
    color: '#111',
    fontSize: 18,
    fontWeight: '800',
  },
  outcomeHero: {
    alignItems: 'center',
  },
  verifiedCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedTick: {
    color: '#FFF',
    fontSize: 48,
    lineHeight: 52,
    fontWeight: '900',
  },
  notVerifiedCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 4,
    borderColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notVerifiedMark: {
    color: '#111',
    fontSize: 52,
    lineHeight: 54,
    fontWeight: '700',
  },
  outcomeEyebrow: {
    marginTop: 18,
    color: '#777',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.7,
  },
  verifiedTitle: {
    marginTop: 6,
    color: '#111',
    fontSize: 38,
    lineHeight: 43,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  notVerifiedTitle: {
    marginTop: 6,
    color: '#111',
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  outcomeTime: {
    marginTop: 12,
    color: '#111',
    fontSize: 64,
    lineHeight: 70,
    fontWeight: '900',
    letterSpacing: -1.7,
  },
  outcomeSeconds: {
    marginTop: -2,
    color: '#111',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  verifiedStatusCard: {
    marginTop: 22,
    padding: 17,
    borderRadius: 20,
    backgroundColor: '#ECEAE3',
    borderWidth: 1,
    borderColor: '#DDDAD0',
  },
  verifiedStatusTitle: {
    color: '#111',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  verifiedStatusText: {
    marginTop: 6,
    color: '#555',
    fontSize: 13,
    lineHeight: 19,
  },
  verifiedStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  verifiedStatCard: {
    flex: 1,
    padding: 14,
    borderRadius: 17,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E0D8',
  },
  verifiedStatLabel: {
    color: '#777',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  verifiedStatValue: {
    marginTop: 5,
    color: '#111',
    fontSize: 24,
    fontWeight: '900',
  },
  verifiedStatHint: {
    marginTop: 4,
    color: '#777',
    fontSize: 10,
    lineHeight: 14,
  },
  notVerifiedReasonCard: {
    marginTop: 22,
    padding: 17,
    borderRadius: 20,
    backgroundColor: '#ECEAE3',
    borderWidth: 1,
    borderColor: '#DDDAD0',
  },
  notVerifiedReasonLabel: {
    color: '#777',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  notVerifiedReasonTitle: {
    marginTop: 5,
    color: '#111',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  notVerifiedReasonText: {
    marginTop: 6,
    color: '#555',
    fontSize: 13,
    lineHeight: 19,
  },
  notVerifiedInfoCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E0D8',
  },
  notVerifiedInfoTitle: {
    color: '#111',
    fontSize: 15,
    fontWeight: '900',
  },
  notVerifiedInfoText: {
    marginTop: 5,
    color: '#555',
    fontSize: 13,
    lineHeight: 19,
  },
  outcomePrimaryButton: {
    marginTop: 18,
    paddingVertical: 17,
    borderRadius: 17,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  outcomePrimaryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  outcomeSecondaryButton: {
    marginTop: 9,
    paddingVertical: 13,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#D7D4CC',
    backgroundColor: '#FFF',
    alignItems: 'center',
  },
  outcomeSecondaryButtonText: {
    color: '#555',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  outcomeTextButton: {
    marginTop: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  outcomeTextButtonText: {
    color: '#666',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  outcomeFootnote: {
    marginTop: 7,
    color: '#777',
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
  pendingScreenContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 62,
    paddingBottom: 34,
  },
  pendingHero: {
    alignItems: 'center',
  },
  pendingTickCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingTickMark: {
    color: '#FFF',
    fontSize: 36,
    lineHeight: 39,
    fontWeight: '900',
  },
  pendingEyebrow: {
    marginTop: 17,
    color: '#777',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.7,
  },
  pendingTitleLarge: {
    marginTop: 6,
    color: '#111',
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  pendingSubmittedTime: {
    marginTop: 13,
    color: '#111',
    fontSize: 52,
    lineHeight: 58,
    fontWeight: '900',
    letterSpacing: -1.3,
  },
  pendingSecondsLabel: {
    marginTop: -2,
    color: '#111',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  pendingStatusCard: {
    marginTop: 21,
    padding: 17,
    borderRadius: 20,
    backgroundColor: '#ECEAE3',
    borderWidth: 1,
    borderColor: '#DDDAD0',
  },
  pendingStatusLabel: {
    color: '#777',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  pendingStatusValue: {
    marginTop: 5,
    color: '#111',
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '900',
  },
  pendingStatusText: {
    marginTop: 7,
    color: '#555',
    fontSize: 14,
    lineHeight: 20,
  },
  pendingInfoCard: {
    marginTop: 14,
    padding: 17,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E0D8',
  },
  pendingInfoTitle: {
    marginBottom: 11,
    color: '#111',
    fontSize: 17,
    fontWeight: '900',
  },
  pendingInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  pendingInfoDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 10,
    paddingTop: 3,
    backgroundColor: '#111',
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  pendingInfoText: {
    flex: 1,
    color: '#444',
    fontSize: 13,
    lineHeight: 19,
  },
  pendingPrimaryButton: {
    marginTop: 18,
    paddingVertical: 17,
    borderRadius: 17,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  pendingPrimaryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  pendingSecondaryButton: {
    marginTop: 9,
    paddingVertical: 13,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#D7D4CC',
    backgroundColor: '#FFF',
    alignItems: 'center',
  },
  pendingSecondaryButtonText: {
    color: '#555',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  pendingFootnote: {
    marginTop: 11,
    color: '#777',
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
  attemptsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  attemptsHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  attemptsRefreshButton: {
    marginTop: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7D4CC',
    backgroundColor: '#FFF',
  },
  attemptsRefreshText: {
    color: '#555',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  attemptsMessageCard: {
    marginTop: 20,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E0D8',
  },
  attemptsMessageTitle: {
    color: '#111',
    fontSize: 17,
    fontWeight: '900',
  },
  attemptsMessageText: {
    marginTop: 5,
    color: '#666',
    fontSize: 13,
    lineHeight: 19,
  },
  attemptsErrorCard: {
    marginTop: 20,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#ECEAE3',
    borderWidth: 1,
    borderColor: '#DDDAD0',
  },
  attemptsErrorTitle: {
    color: '#111',
    fontSize: 17,
    fontWeight: '900',
  },
  attemptsErrorText: {
    marginTop: 5,
    color: '#555',
    fontSize: 13,
    lineHeight: 19,
  },
  attemptsRetryButton: {
    marginTop: 12,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  attemptsRetryText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  attemptCardMain: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  attemptId: {
    marginTop: 4,
    color: '#888',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  attemptStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 13,
    backgroundColor: '#ECEAE3',
  },
  attemptVerifiedBadge: {
    backgroundColor: '#111',
  },
  attemptRejectedBadge: {
    borderWidth: 1,
    borderColor: '#111',
    backgroundColor: '#FFF',
  },
  attemptStatusBadgeText: {
    color: '#444',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  attemptVerifiedBadgeText: {
    color: '#FFF',
  },
  attemptOpenHint: {
    marginTop: 12,
    color: '#777',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  attemptsPrototypeNote: {
    marginTop: 12,
    paddingHorizontal: 8,
    color: '#888',
    fontSize: 9,
    lineHeight: 13,
    textAlign: 'center',
  },
  reviewAccessCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#ECEAE3',
    borderWidth: 1,
    borderColor: '#DDDAD0',
  },
  reviewAccessLabel: {
    color: '#777',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  reviewAccessText: {
    marginTop: 5,
    color: '#555',
    fontSize: 12,
    lineHeight: 17,
  },
  reviewAccessButton: {
    marginTop: 11,
    paddingVertical: 12,
    borderRadius: 13,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  reviewAccessButtonText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  reviewScreenContent: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 40,
  },
  reviewEyebrow: {
    marginTop: 18,
    color: '#777',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  reviewTitle: {
    marginTop: 4,
    color: '#111',
    fontSize: 42,
    lineHeight: 47,
    fontWeight: '900',
    letterSpacing: -1,
  },
  reviewIntro: {
    marginTop: 8,
    color: '#666',
    fontSize: 15,
    lineHeight: 21,
  },
  reviewWarningCard: {
    marginTop: 18,
    padding: 15,
    borderRadius: 17,
    backgroundColor: '#ECEAE3',
    borderWidth: 1,
    borderColor: '#DDDAD0',
  },
  reviewWarningTitle: {
    color: '#111',
    fontSize: 14,
    fontWeight: '900',
  },
  reviewWarningText: {
    marginTop: 5,
    color: '#555',
    fontSize: 12,
    lineHeight: 17,
  },
  reviewSuccessCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 15,
    backgroundColor: '#111',
  },
  reviewSuccessTitle: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.0,
  },
  reviewSuccessText: {
    marginTop: 5,
    color: '#E5E5E5',
    fontSize: 12,
    lineHeight: 17,
  },
  reviewSaveInstruction: {
    marginTop: 14,
    color: '#777',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
  },
  reviewEmptyCard: {
    marginTop: 18,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E0D8',
  },
  reviewEmptyTitle: {
    color: '#111',
    fontSize: 18,
    fontWeight: '900',
  },
  reviewEmptyText: {
    marginTop: 5,
    color: '#666',
    fontSize: 13,
    lineHeight: 18,
  },
  reviewQueueCard: {
    marginTop: 12,
    padding: 17,
    borderRadius: 19,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E0D8',
  },
  reviewQueueTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  reviewQueueChallenge: {
    color: '#777',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  reviewQueueTime: {
    marginTop: 3,
    color: '#111',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
  },
  reviewQueueId: {
    marginTop: 3,
    color: '#888',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  reviewPendingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#ECEAE3',
  },
  reviewPendingBadgeText: {
    color: '#444',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  reviewQueueHint: {
    marginTop: 14,
    color: '#777',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.75,
  },
  reviewRefreshButton: {
    marginTop: 16,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D7D4CC',
    backgroundColor: '#FFF',
    alignItems: 'center',
  },
  reviewRefreshButtonText: {
    color: '#555',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  reviewAttemptHero: {
    marginTop: 18,
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  reviewAttemptLabel: {
    color: '#BFBFBF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  reviewAttemptTime: {
    marginTop: 4,
    color: '#FFF',
    fontSize: 56,
    lineHeight: 62,
    fontWeight: '900',
    letterSpacing: -1.5,
  },
  reviewAttemptSeconds: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  reviewVideoPlaceholder: {
    marginTop: 13,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#ECEAE3',
    borderWidth: 1,
    borderColor: '#DDDAD0',
  },
  reviewVideoPlaceholderTitle: {
    color: '#111',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  reviewVideoPlaceholderText: {
    marginTop: 6,
    color: '#666',
    fontSize: 11,
    lineHeight: 16,
  },
  reviewVideoCard: {
    marginTop: 13,
    padding: 12,
    borderRadius: 18,
    backgroundColor: '#ECEAE3',
    borderWidth: 1,
    borderColor: '#DDDAD0',
  },
  reviewVideoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  reviewVideoLabel: {
    color: '#111',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  reviewVideoPath: {
    marginTop: 4,
    maxWidth: 230,
    color: '#777',
    fontSize: 9,
    lineHeight: 13,
  },
  reviewVideoReloadButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 11,
    backgroundColor: '#111',
  },
  reviewVideoReloadText: {
    color: '#FFF',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  reviewVideo: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 520,
    borderRadius: 14,
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  reviewVideoState: {
    minHeight: 210,
    borderRadius: 14,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  reviewVideoStateTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  reviewVideoStateText: {
    marginTop: 7,
    color: '#D0D0D0',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  reviewVideoPrivacyNote: {
    marginTop: 8,
    color: '#777',
    fontSize: 9,
    lineHeight: 13,
    textAlign: 'center',
  },
  reviewChecklistCard: {
    marginTop: 13,
    padding: 17,
    borderRadius: 19,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E0D8',
  },
  reviewChecklistTitle: {
    color: '#111',
    fontSize: 17,
    fontWeight: '900',
  },
  reviewChecklistItem: {
    marginTop: 8,
    color: '#444',
    fontSize: 13,
    lineHeight: 18,
  },
  reviewReasonCard: {
    marginTop: 13,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#ECEAE3',
    borderWidth: 1,
    borderColor: '#DDDAD0',
  },
  reviewReasonLabel: {
    color: '#777',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  reviewReasonHelp: {
    marginTop: 4,
    color: '#666',
    fontSize: 11,
    lineHeight: 16,
  },
  reviewReasonInput: {
    minHeight: 92,
    marginTop: 10,
    padding: 12,
    borderRadius: 13,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D7D4CC',
    color: '#111',
    fontSize: 13,
    lineHeight: 18,
  },
  reviewMessageCard: {
    marginTop: 12,
    padding: 13,
    borderRadius: 13,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#111',
  },
  reviewMessageText: {
    color: '#111',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  reviewVerifyButton: {
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  reviewVerifyButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  reviewRejectButton: {
    marginTop: 9,
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#111',
    alignItems: 'center',
  },
  reviewRejectButtonText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  reviewDecisionDisabled: {
    opacity: 0.5,
  },
  reviewDecisionNote: {
    marginTop: 12,
    paddingHorizontal: 8,
    color: '#777',
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
  attemptsScreenContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 34,
  },
  attemptsEyebrow: {
    marginTop: 8,
    color: '#777',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.7,
  },
  attemptsTitle: {
    marginTop: 5,
    color: '#111',
    fontSize: 36,
    lineHeight: 41,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  attemptsIntro: {
    marginTop: 7,
    color: '#666',
    fontSize: 15,
    lineHeight: 21,
  },
  attemptCard: {
    marginTop: 20,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E0D8',
  },
  attemptCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  attemptChallenge: {
    color: '#777',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  attemptTime: {
    marginTop: 4,
    color: '#111',
    fontSize: 28,
    fontWeight: '900',
  },
  attemptPendingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 13,
    backgroundColor: '#ECEAE3',
  },
  attemptPendingBadgeText: {
    color: '#444',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  attemptDivider: {
    height: 1,
    backgroundColor: '#E5E2DA',
    marginVertical: 14,
  },
  attemptStatusLabel: {
    color: '#777',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  attemptStatusValue: {
    marginTop: 4,
    color: '#111',
    fontSize: 17,
    fontWeight: '900',
  },
  attemptStatusText: {
    marginTop: 5,
    color: '#555',
    fontSize: 13,
    lineHeight: 18,
  },
  tick: {
    fontSize: 72,
    fontWeight: '900',
    color: '#111',
  },
  pendingTime: {
    marginTop: 10,
    fontSize: 30,
    fontWeight: '900',
    color: '#111',
  },
  pendingTitle: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: '900',
    color: '#111',
  },
  screenScroll: {
    flex: 1,
  },
  cooldownCheckingCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 17,
    backgroundColor: '#ECEAE3',
    borderWidth: 1,
    borderColor: '#DDDAD0',
    alignItems: 'center',
  },
  cooldownCheckingLabel: {
    color: '#111',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  cooldownCheckingText: {
    marginTop: 6,
    color: '#555',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  cooldownErrorCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 17,
    backgroundColor: '#ECEAE3',
    borderWidth: 1,
    borderColor: '#111',
    alignItems: 'center',
  },
  cooldownErrorLabel: {
    color: '#111',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  cooldownErrorText: {
    marginTop: 6,
    color: '#555',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  cooldownRetryButton: {
    marginTop: 11,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#111',
  },
  cooldownRetryButtonText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  cooldownActiveCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 17,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  cooldownActiveLabel: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  cooldownActiveTime: {
    marginTop: 4,
    color: '#FFF',
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '900',
    letterSpacing: -1,
  },
  cooldownActiveText: {
    marginTop: 3,
    color: '#E2E2E2',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  cooldownPersistentText: {
    marginTop: 8,
    color: '#BFBFBF',
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
  cooldownInfoCard: {
    marginTop: 14,
    padding: 17,
    borderRadius: 20,
    backgroundColor: '#ECEAE3',
    borderWidth: 1,
    borderColor: '#DDDAD0',
  },
  cooldownInfoSmall: {
    marginTop: 8,
    color: '#555',
    fontSize: 12,
    lineHeight: 18,
  },
  cooldownPrototypeNote: {
    marginTop: 9,
    color: '#777',
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '700',
  },
  cooldownRulesSection: {
    backgroundColor: '#ECEAE3',
  },
  cooldownWhyBox: {
    marginTop: 2,
    marginBottom: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D7D4CC',
  },
  cooldownWhyLabel: {
    color: '#111',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  cooldownWhyText: {
    marginTop: 6,
    color: '#444',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  cooldownRulesPrototype: {
    marginTop: 6,
    color: '#777',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  rulesCooldownLock: {
    marginTop: 14,
    padding: 16,
    borderRadius: 17,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  rulesCooldownLockLabel: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  rulesCooldownLockTime: {
    marginTop: 4,
    color: '#FFF',
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '900',
  },
  rulesCooldownLockText: {
    marginTop: 4,
    color: '#E2E2E2',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  rulesCooldownPersistentText: {
    marginTop: 8,
    color: '#BFBFBF',
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
  rulesCooldownRetryButton: {
    marginTop: 11,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFF',
  },
  rulesCooldownRetryButtonText: {
    color: '#111',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  challengeScrollContent: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 36,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingRight: 16,
    marginBottom: 8,
  },
  homeContainer: {
    flexGrow: 1,
    padding: 22,
    paddingBottom: 36,
    justifyContent: 'space-between',
  },
  brand: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: '#111',
  },
  brandTagline: {
    marginTop: 4,
    fontSize: 16,
    color: '#666',
  },
  featuredCard: {
    marginTop: 22,
  },
  comingSoonCard: {
    marginTop: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  liveBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#E8E6DD',
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#111',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#777',
  },
  soonBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D9D7CF',
  },
  soonBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#666',
  },
  homeChallengeTitle: {
    marginTop: 18,
    fontSize: 30,
    fontWeight: '900',
    color: '#111',
  },
  homeChallengeTitleSmall: {
    fontSize: 21,
    fontWeight: '900',
    color: '#111',
  },
  homeChallengeDescription: {
    marginTop: 8,
    fontSize: 17,
    lineHeight: 24,
    color: '#444',
  },
  challengeDescription: {
    marginTop: 12,
    fontSize: 20,
    lineHeight: 28,
    color: '#333',
  },
  challengeSubline: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '800',
    color: '#555',
  },
  statsRow: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E0D8',
    backgroundColor: '#FAF9F5',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#777',
  },
  statValue: {
    marginTop: 7,
    fontSize: 18,
    fontWeight: '900',
    color: '#111',
  },
  statValueSmall: {
    marginTop: 7,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
    color: '#111',
  },
  statHint: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 15,
    color: '#777',
  },
  officialLine: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '800',
    color: '#222',
  },
  homeAttemptsButton: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D7D4CC',
    alignItems: 'center',
  },
  homeAttemptsButtonText: {
    color: '#555',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  sectionHeading: {
    marginTop: 20,
    fontSize: 16,
    fontWeight: '900',
    color: '#111',
  },
  measurementLabel: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E0D8',
    fontSize: 14,
    fontWeight: '800',
    color: '#333',
  },
  twoButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  halfButton: {
    flex: 1,
  },
  secondaryTextSmall: {
    color: '#111',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  infoCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#ECEAE2',
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111',
  },
  bottomNav: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#D9D7CF',
    flexDirection: 'row',
    gap: 6,
  },
  navItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  navItemActive: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#E8E6DD',
  },
  navItemDisabled: {
    opacity: 0.45,
  },
  navText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
  },
  navTextActive: {
    fontSize: 12,
    fontWeight: '900',
    color: '#111',
  },

});
