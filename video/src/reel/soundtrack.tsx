// The soundtrack for videos longer than the track's body: it plays up to just before the track's own
// outro, crossfades over one bar back into an earlier full section on the same beat grid (so the
// cut lands on the beat), and fades out over the video's last seconds.
import { Audio } from "@remotion/media";
import { Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { barF, barsF, clamp } from "./beat";

const SRC = "audio/bgm.m4a";
/** The track's outro (its own fade) starts after bar 77; loop before it, back to bar 8. */
const LOOP_AT = 76;
const RESUME_AT = 8;
const FADE_OUT_S = 3;

const Part: React.FC<{ trimBefore: number; fadeIn: number; fadeOutAt: number | null; fadeOutLen: number }> = ({ trimBefore, fadeIn, fadeOutAt, fadeOutLen }) => {
  const frame = useCurrentFrame();
  const fadeInV = fadeIn ? interpolate(frame, [0, fadeIn], [0, 1], clamp) : 1;
  const fadeOutV = fadeOutAt === null ? 1 : interpolate(frame, [fadeOutAt, fadeOutAt + fadeOutLen], [1, 0], clamp);
  return <Audio src={staticFile(SRC)} trimBefore={trimBefore} volume={Math.min(fadeInV, fadeOutV)} />;
};

export const Soundtrack: React.FC = () => {
  const { fps, durationInFrames } = useVideoConfig();
  const fadeOut = Math.round(FADE_OUT_S * fps);
  const end = durationInFrames - fadeOut; // where the closing fade starts
  const loopAt = barF(LOOP_AT, fps);
  const xf = barsF(LOOP_AT, LOOP_AT + 1, fps); // one bar of crossfade
  if (durationInFrames <= loopAt)
    return (
      <Sequence durationInFrames={durationInFrames}>
        <Part trimBefore={0} fadeIn={Math.round(0.4 * fps)} fadeOutAt={end} fadeOutLen={fadeOut} />
      </Sequence>
    );
  // reel bar LOOP_AT + k plays source bar RESUME_AT + k: same grid, so beats line up through the crossfade
  const resumeFrom = barF(RESUME_AT, fps);
  return (
    <>
      <Sequence durationInFrames={loopAt + xf}>
        <Part trimBefore={0} fadeIn={Math.round(0.4 * fps)} fadeOutAt={Math.min(loopAt, end)} fadeOutLen={xf} />
      </Sequence>
      <Sequence from={loopAt}>
        <Part trimBefore={resumeFrom} fadeIn={xf} fadeOutAt={end - loopAt} fadeOutLen={fadeOut} />
      </Sequence>
    </>
  );
};
