import styled from "styled-components";

const Page = styled.main`
  position: relative;
  display: grid;
  place-items: center;
  min-height: 100svh;
  padding: 24px;
  background: #1e90ff; /* lighter blueprint-like blue (Xcode feel) */
  color: #f0f8ff;
  overflow: hidden;
`;

const Title = styled.h1`
  margin: 0;
  font-size: clamp(32px, 7vw, 80px);
  line-height: 1.02;
  letter-spacing: -0.02em;
  text-align: center;
  background: linear-gradient(90deg, #ffffff 0%, #dbeafe 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
`;

export default function MindStudioDefaultPage() {
  return (
    <Page>
      <Title>MindStudio Custom Interface</Title>
    </Page>
  );
}
