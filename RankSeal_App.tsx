import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://gilbsqbfrvldpscbfert.supabase.co',
  'sb_publishable_ROci_eJJYN6yRqjtmjj99Q_VmG95ZIW'
);
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

  const [permission, requestPermission] = useCameraPermissions();

  const cameraRef = useRef(null);
  const timerRef = useRef(null);
  const startRef = useRef(0);
  const recordingPromiseRef = useRef(null);

  const formatTime = (ms) => ((ms || 0) / 1000).toFixed(2);

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
  };

  const openCamera = () => {
    resetAttempt();
    setCameraSetupConfirmed(false);
    setPrecheckConfirmed(false);
    setScreen('camera');
  };
const submitAttempt = async () => {
  const { error } = await supabase
    .from('attempts')
    .insert({
      time_ms: finalTime,
      video_path: 'prototype-test',
      status: 'pending',
    });

  if (error) {
    console.log('Submit error:', error);
    return;
  }

  setScreen('pending');
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
    if (screen !== 'camera' || phase !== 'countdown') return;

    if (countdown <= 0) {
      startRef.current = Date.now();
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
                <Text style={styles.statValue}>—</Text>
                <Text style={styles.statHint}>Verified results only</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.officialLine}>✓ Official RankSeal challenge</Text>
              <Text style={styles.bodyText}>
                Official attempts are recorded and verified before entering the leaderboard.
              </Text>

              <Pressable style={styles.primary} onPress={() => { setRulesAccepted(false); setScreen('rules'); }}>
                <Text style={styles.primaryText}>START OFFICIAL ATTEMPT</Text>
              </Pressable>

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

          <Pressable
            style={[styles.rulesPrimary, !rulesAccepted && styles.primaryDisabled]}
            onPress={openCamera}
            disabled={!rulesAccepted}
          >
            <Text style={styles.rulesPrimaryText}>CONTINUE TO CAMERA SETUP</Text>
          </Pressable>
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
            <>
              <View style={styles.cameraTopCard}>
                <Text style={styles.camera568}>568</Text>
                <Text style={styles.cameraInstruction}>
                  Camera setup confirmed. Get ready for the official attempt.
                </Text>
              </View>

              <View style={styles.cameraBottom}>
                <Pressable
                  style={[
                    styles.whiteButton,
                    !cameraReady && styles.disabledButton,
                  ]}
                  disabled={!cameraReady}
                  onPress={startCountdown}
                >
                  <Text style={styles.whiteButtonText}>
                    {cameraReady ? 'START COUNTDOWN' : 'CAMERA LOADING…'}
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          {phase === 'countdown' && (
            <View style={styles.cameraCenter}>
              <Text style={styles.countdown}>
                {countdown > 0 ? countdown : 'GO!'}
              </Text>
            </View>
          )}

          {phase === 'drinking' && (
            <>
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
            </>
          )}

          {phase === 'flip' && (
            <>
              <View style={styles.flipCard}>
                <Text style={styles.frozenTime}>{formatTime(finalTime)} SEC</Text>
                <Text style={styles.flipTitle}>TURN THE GLASS UPSIDE DOWN</Text>
                <Text style={styles.cameraInstruction}>
                  Keep the glass inverted and visible. Recording is still running.
                </Text>
              </View>

              <View style={styles.cameraBottom}>
                <Pressable style={styles.whiteButton} onPress={finishRecording}>
                  <Text style={styles.whiteButtonText}>FINISH RECORDING</Text>
                </Pressable>
              </View>
            </>
          )}
        </SafeAreaView>
      </View>
    );
  }

  if (screen === 'result') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.center}>
            <Text style={styles.eyebrow}>YOUR TIME</Text>
            <Text style={styles.resultTime}>{formatTime(finalTime)}</Text>
            <Text style={styles.secondsDark}>SECONDS</Text>

            <Text style={styles.resultText}>
              {videoUri
                ? 'Your attempt was recorded successfully.'
                : 'Your attempt finished, but the video could not be confirmed.'}
            </Text>

            <Pressable
              style={styles.primary}
              onPress={submitAttempt}
            >
              <Text style={styles.primaryText}>SUBMIT ATTEMPT</Text>
            </Pressable>

            <Pressable
              style={styles.secondary}
              onPress={() => {
                resetAttempt();
                setScreen('home');
              }}
            >
              <Text style={styles.secondaryText}>DISCARD</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === 'pending') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.center}>
            <Text style={styles.tick}>✓</Text>
            <Text style={styles.title}>Attempt submitted</Text>
            <Text style={styles.pendingTime}>{formatTime(finalTime)} seconds</Text>

            <View style={styles.card}>
              <Text style={styles.eyebrow}>STATUS</Text>
              <Text style={styles.pendingTitle}>PENDING REVIEW</Text>
              <Text style={styles.bodyText}>
                Prototype stage: the review upload system is the next feature we will build.
              </Text>
            </View>

            <Pressable style={styles.primary} onPress={() => setScreen('home')}>
              <Text style={styles.primaryText}>BACK TO HOME</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === 'leaderboard') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Pressable onPress={() => setScreen('challenge568')}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>

          <View style={styles.content}>
            <Text style={styles.eyebrow}>WORLD RANKINGS</Text>
            <Text style={styles.title}>Leaderboard</Text>

            <View style={styles.card}>
              <Text style={styles.emptyTitle}>No verified attempts yet.</Text>
              <Text style={styles.bodyText}>
                The first approved attempt becomes World #1.
              </Text>
            </View>
          </View>
        </View>
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
