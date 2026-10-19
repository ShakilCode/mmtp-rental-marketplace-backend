export const validatePassword = (password) => {
  const errors = [];

  if (!password || password.length < 8) errors.push("at least 8 characters");
  if (!/[a-z]/.test(password)) errors.push("one lowercase letter");
  if (!/[A-Z]/.test(password)) errors.push("one uppercase letter");
  if (!/\d/.test(password)) errors.push("one number");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("one special character (e.g. @ # $ !)");

  return errors; // empty array means the password is valid
};