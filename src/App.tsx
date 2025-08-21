import { useState } from 'react';
import styled from 'styled-components';

const Page = styled.div`
  font-family: 'Segoe UI', Tahoma, sans-serif;
  background: #f4f6f9;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  margin: 0;
`;

const Card = styled.div`
  background: #fff;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 360px;
`;

const Title = styled.h2`
  margin: 0 0 20px;
  text-align: center;
  color: #333;
  font-weight: 700;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  font-size: 15px;
  border: 1px solid #ccc;
  margin-bottom: 16px;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:focus {
    border-color: #e63946;
    box-shadow: 0 0 0 3px rgba(230, 57, 70, 0.2);
    outline: none;
  }
`;

const Submit = styled.button`
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 700;
  background: #e63946;
  color: #fff;
  border: none;
  cursor: pointer;
  transition: background 0.3s, transform 0.1s;
  text-align: center;

  &:hover {
    background: #d62839;
  }
  &:active {
    transform: scale(0.98);
  }
`;

export default function App() {
  const [nameValue, setNameValue] = useState('');

  const onSubmit = () => {
    try {
      const unsafeWindow: any = window;
      unsafeWindow.onPost({ name: nameValue });
    } catch (err) {
      console.error('Error calling window.onPost:', err);
    }
  };

  return (
    <Page>
      <Card>
        <Title>What is your name?</Title>
        <Input
          type="text"
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          placeholder="Jane Doe"
          autoComplete="name"
        />

        <Submit type="submit" onClick={() => onSubmit()}>
          Submit
        </Submit>
      </Card>
    </Page>
  );
}
