import styled, { css, keyframes } from 'styled-components';

const gradientShift = keyframes`
  0% { transform: translate3d(-10%, -10%, 0) rotate(0deg) scale(1); }
  50% { transform: translate3d(10%, 10%, 0) rotate(180deg) scale(1.05); }
  100% { transform: translate3d(-10%, -10%, 0) rotate(360deg) scale(1); }
`;

const GrainSvg = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23n)" opacity="0.7"/></svg>`;

const Frame = styled.div`
  width: 1200px;
  height: 630px;
  position: relative;
  display: grid;
  place-items: center;
  background: #0a0a0a;
  color: #e8eaf6;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    inset: -20%;
    opacity: 0.7;
    mix-blend-mode: overlay;
    pointer-events: none;
    z-index: 1;
    background-image: url('${GrainSvg}');
    background-size: 280px 280px;
  }
`;

const GradientBlobs = styled.div`
  position: absolute;
  inset: -80%;
  filter: blur(80px) saturate(130%);
  opacity: 0.75;
  z-index: 0;
  transform: translateZ(0);
  background: radial-gradient(
      45% 45% at 20% 30%,
      rgba(110, 231, 249, 0.55) 0%,
      rgba(110, 231, 249, 0.1) 60%,
      rgba(110, 231, 249, 0.04) 100%
    ),
    radial-gradient(
      45% 45% at 80% 25%,
      rgba(167, 139, 250, 0.55) 0%,
      rgba(167, 139, 250, 0.1) 60%,
      rgba(167, 139, 250, 0.04) 100%
    ),
    radial-gradient(
      40% 40% at 60% 70%,
      rgba(244, 114, 182, 0.55) 0%,
      rgba(244, 114, 182, 0.1) 60%,
      rgba(244, 114, 182, 0.04) 100%
    ),
    radial-gradient(
      40% 40% at 30% 80%,
      rgba(253, 230, 138, 0.55) 0%,
      rgba(253, 230, 138, 0.1) 60%,
      rgba(253, 230, 138, 0.04) 100%
    );
  background-blend-mode: screen;
  animation: ${css`
      ${gradientShift}`} 20s linear infinite;
  pointer-events: none;
`;

const Vignette = styled.div`
  position: absolute;
  inset: -5%;
  pointer-events: none;
  z-index: 0;
  background: radial-gradient(
    120% 120% at 50% 40%,
    transparent 20%,
    rgba(0, 0, 0, 0.35) 70%
  );
`;

const Card = styled.section`
  position: relative;
  z-index: 2;
  mix-blend-mode: soft-light;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;

  svg {
    height: 80px;
    color: white;
  }
`;

const Title = styled.h1`
  margin: 0;
  padding: 0;
  text-align: center;
  font-size: 48px;
  letter-spacing: -0.015em;
  color: white;
`;

export default function OpenGraphCard() {
  return (
    <Frame>
      <GradientBlobs />
      <Vignette />

      <Card>
        <svg
          viewBox="0 0 500 294"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M220.455 69.0404C217.015 79.5103 214.91 90.6612 209.911 100.336C183.279 151.886 156.203 203.216 128.72 254.325C109.082 290.844 68.6078 303.843 34.5176 285.449C1.34953 267.553 -9.70976 227.458 9.24072 191.185C36.6268 138.768 64.0075 86.3344 92.4367 34.4744C108.052 5.98846 139.402 -5.60247 170.269 3.24165C199.116 11.5075 218.824 38.1132 220.455 69.0404Z"
            fill="currentColor"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M405.424 68.7064C401.984 79.1764 399.879 90.3272 394.881 100.002C368.248 151.552 341.172 202.882 313.689 253.991C294.052 290.51 253.577 303.509 219.487 285.115C186.319 267.219 175.259 227.124 194.21 190.851C221.596 138.434 248.977 86.0005 277.406 34.1404C293.021 5.65448 324.372 -5.93645 355.238 2.90766C384.085 11.1735 403.793 37.7793 405.424 68.7064Z"
            fill="currentColor"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M433.798 88.1226C452.867 121.588 471.675 153.892 489.804 186.614C507.386 218.35 501.744 255.021 476.621 277.265C451.785 299.255 415.202 299.232 390.722 277.211C365.778 254.773 360.346 217.918 377.917 186.404C396.12 153.756 414.834 121.424 433.798 88.1226Z"
            fill="currentColor"
          />
        </svg>

        <Title>Empty Interface</Title>
      </Card>
    </Frame>
  );
}
