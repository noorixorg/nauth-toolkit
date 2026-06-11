import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SignupDTO } from './signup.dto';
import { AdminSignupDTO } from './admin-signup.dto';
import { AdminSignupSocialDTO } from './admin-signup-social.dto';
import { UserUpdateDTO } from './user-update.dto';

describe('Name fields (firstName/lastName) validation', () => {
  const specialNames = {
    firstName: 'José 🚀 (QA) / R&D',
    lastName: 'O’Connor-Smith #2',
  };

  it('SignupDTO should accept special characters in firstName/lastName', async () => {
    const dto = plainToInstance(SignupDTO, {
      email: 'user@example.com',
      password: 'passwordpassword',
      ...specialNames,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('AdminSignupDTO should accept special characters in firstName/lastName', async () => {
    const dto = plainToInstance(AdminSignupDTO, {
      email: 'user@example.com',
      password: 'passwordpassword',
      ...specialNames,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('AdminSignupSocialDTO should accept special characters in firstName/lastName', async () => {
    const dto = plainToInstance(AdminSignupSocialDTO, {
      email: 'user@example.com',
      provider: 'google',
      providerId: 'google_123',
      ...specialNames,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('UserUpdateDTO should accept special characters in firstName/lastName', async () => {
    const dto = plainToInstance(UserUpdateDTO, {
      ...specialNames,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
