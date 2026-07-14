import React from 'react';
import { render } from '@testing-library/react-native';
import App from '../App';

test('renders SofiLink title', () => {
  const { getByText } = render(<App />);
  expect(getByText('SofiLink')).toBeTruthy();
});
