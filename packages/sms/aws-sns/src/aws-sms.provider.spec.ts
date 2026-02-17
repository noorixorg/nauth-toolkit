import { AWSSMSProvider } from './aws-sms.provider';
import { AWSSMSConfig } from './aws-sms-config.interface';
import { NAuthException } from '@nauth-toolkit/core';

// ============================================================================
// Mock AWS SDK Modules
// ============================================================================

// Mock SNS
const mockSNSSend = jest.fn();
const MockSNSClient = jest.fn().mockImplementation(() => ({
  send: mockSNSSend,
}));
const MockPublishCommand = jest.fn();

// Mock End User Messaging SMS (client-pinpoint-sms-voice-v2)
const mockEndUserMessagingSend = jest.fn();
const MockEndUserMessagingClient = jest.fn().mockImplementation(() => ({
  send: mockEndUserMessagingSend,
}));
const MockSendTextMessageCommand = jest.fn();

// Mock dynamic imports
jest.mock('@aws-sdk/client-sns', () => ({
  SNSClient: MockSNSClient,
  PublishCommand: MockPublishCommand,
}));

jest.mock('@aws-sdk/client-pinpoint-sms-voice-v2', () => ({
  PinpointSMSVoiceV2Client: MockEndUserMessagingClient,
  SendTextMessageCommand: MockSendTextMessageCommand,
}));

describe('AWSSMSProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSNSSend.mockResolvedValue({ MessageId: 'test-message-id' });
    mockEndUserMessagingSend.mockResolvedValue({ MessageId: 'test-message-id-eum' });
  });

  // ============================================================================
  // Constructor Tests
  // ============================================================================

  describe('constructor', () => {
    it('should initialize with minimal configuration (SNS mode default)', () => {
      const config: AWSSMSConfig = {
        region: 'us-east-1',
        originationNumber: '+12345678901',
      };

      expect(() => new AWSSMSProvider(config)).not.toThrow();
    });

    it('should initialize with End User Messaging SMS mode', () => {
      const config: AWSSMSConfig = {
        region: 'ap-southeast-2',
        originationNumber: 'anyspaces',
        apiMode: 'end-user-messaging-sms',
        configurationSetName: 'default',
      };

      expect(() => new AWSSMSProvider(config)).not.toThrow();
    });

    it('should accept a logger via setLogger', () => {
      const config: AWSSMSConfig = {
        region: 'us-east-1',
        originationNumber: '+12345678901',
      };

      const provider = new AWSSMSProvider(config);
      const mockLogger = { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
      provider.setLogger(mockLogger as any);

      // After setLogger, calls should go through the provided logger
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('AWS SMS Provider logger attached'),
      );
    });

    it('should throw if region is missing', () => {
      const config = {
        originationNumber: '+12345678901',
      } as AWSSMSConfig;

      expect(() => new AWSSMSProvider(config)).toThrow(NAuthException);
      expect(() => new AWSSMSProvider(config)).toThrow(
        'AWS SMS Provider: region and originationNumber are required',
      );
    });

    it('should throw if originationNumber is missing', () => {
      const config = {
        region: 'us-east-1',
      } as AWSSMSConfig;

      expect(() => new AWSSMSProvider(config)).toThrow(NAuthException);
    });

    it('should throw if accessKeyId provided without secretAccessKey', () => {
      const config: AWSSMSConfig = {
        region: 'us-east-1',
        originationNumber: '+12345678901',
        accessKeyId: 'test-key',
      };

      expect(() => new AWSSMSProvider(config)).toThrow(NAuthException);
      expect(() => new AWSSMSProvider(config)).toThrow(
        'AWS SMS Provider: secretAccessKey is required when accessKeyId is provided',
      );
    });

    it('should initialize with configurationSetName in SNS mode (warning not tested)', () => {
      const config: AWSSMSConfig = {
        region: 'us-east-1',
        originationNumber: '+12345678901',
        apiMode: 'sns',
        configurationSetName: 'default',
      };

      // Should not throw, but configurationSetName will be ignored
      expect(() => new AWSSMSProvider(config)).not.toThrow();
    });
  });

  // ============================================================================
  // SNS Mode Tests
  // ============================================================================

  describe('sendOTP - SNS mode', () => {
    it('should send OTP via SNS with phone number origination', async () => {
      const config: AWSSMSConfig = {
        region: 'us-east-1',
        originationNumber: '+12345678901',
        apiMode: 'sns',
      };

      const provider = new AWSSMSProvider(config);
      await provider.sendOTP('+19876543210', '123456');

      expect(MockSNSClient).toHaveBeenCalledWith({
        region: 'us-east-1',
      });

      expect(MockPublishCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          PhoneNumber: '+19876543210',
          Message: 'Your verification code is: 123456',
          MessageAttributes: expect.objectContaining({
            'AWS.SNS.SMS.SMSType': {
              DataType: 'String',
              StringValue: 'Transactional',
            },
            'AWS.MM.SMS.OriginationNumber': {
              DataType: 'String',
              StringValue: '+12345678901',
            },
          }),
        }),
      );

      expect(mockSNSSend).toHaveBeenCalledTimes(1);
    });

    it('should send OTP via SNS with sender ID origination', async () => {
      const config: AWSSMSConfig = {
        region: 'ap-southeast-2',
        originationNumber: 'MyApp',
        apiMode: 'sns',
      };

      const provider = new AWSSMSProvider(config);
      await provider.sendOTP('+61499453412', '654321');

      expect(MockPublishCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          MessageAttributes: expect.objectContaining({
            'AWS.SNS.SMS.SenderID': {
              DataType: 'String',
              StringValue: 'MyApp',
            },
          }),
        }),
      );
    });

    it('should send OTP via SNS with explicit credentials', async () => {
      const config: AWSSMSConfig = {
        region: 'us-east-1',
        accessKeyId: 'test-key-id',
        secretAccessKey: 'test-secret',
        originationNumber: '+12345678901',
        apiMode: 'sns',
      };

      const provider = new AWSSMSProvider(config);
      await provider.sendOTP('+19876543210', '789012');

      expect(MockSNSClient).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'test-key-id',
          secretAccessKey: 'test-secret',
        },
      });
    });

    it('should handle SNS API errors', async () => {
      mockSNSSend.mockRejectedValueOnce(new Error('SNS API Error'));

      const config: AWSSMSConfig = {
        region: 'us-east-1',
        originationNumber: '+12345678901',
        apiMode: 'sns',
      };

      const provider = new AWSSMSProvider(config);

      await expect(provider.sendOTP('+19876543210', '123456')).rejects.toThrow(
        'AWS SMS delivery failed',
      );
    });
  });

  // ============================================================================
  // End User Messaging SMS Mode Tests
  // ============================================================================

  describe('sendOTP - End User Messaging SMS mode', () => {
    it('should send OTP via End User Messaging SMS API', async () => {
      const config: AWSSMSConfig = {
        region: 'ap-southeast-2',
        originationNumber: 'anyspaces',
        apiMode: 'end-user-messaging-sms',
      };

      const provider = new AWSSMSProvider(config);
      await provider.sendOTP('+61499453412', '123456');

      expect(MockEndUserMessagingClient).toHaveBeenCalledWith({
        region: 'ap-southeast-2',
      });

      expect(MockSendTextMessageCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          DestinationPhoneNumber: '+61499453412',
          MessageBody: 'Your verification code is: 123456',
          MessageType: 'TRANSACTIONAL',
          OriginationIdentity: 'anyspaces',
        }),
      );

      expect(mockEndUserMessagingSend).toHaveBeenCalledTimes(1);
    });

    it('should send OTP with configuration set', async () => {
      const config: AWSSMSConfig = {
        region: 'ap-southeast-2',
        originationNumber: 'anyspaces',
        apiMode: 'end-user-messaging-sms',
        configurationSetName: 'default',
      };

      const provider = new AWSSMSProvider(config);
      await provider.sendOTP('+61499453412', '123456');

      expect(MockSendTextMessageCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ConfigurationSetName: 'default',
        }),
      );
    });

    it('should send OTP with explicit credentials', async () => {
      const config: AWSSMSConfig = {
        region: 'ap-southeast-2',
        accessKeyId: 'test-key-id',
        secretAccessKey: 'test-secret',
        originationNumber: 'anyspaces',
        apiMode: 'end-user-messaging-sms',
      };

      const provider = new AWSSMSProvider(config);
      await provider.sendOTP('+61499453412', '123456');

      expect(MockEndUserMessagingClient).toHaveBeenCalledWith({
        region: 'ap-southeast-2',
        credentials: {
          accessKeyId: 'test-key-id',
          secretAccessKey: 'test-secret',
        },
      });
    });

    it('should handle End User Messaging SMS API errors', async () => {
      mockEndUserMessagingSend.mockRejectedValueOnce(new Error('End User Messaging API Error'));

      const config: AWSSMSConfig = {
        region: 'ap-southeast-2',
        originationNumber: 'anyspaces',
        apiMode: 'end-user-messaging-sms',
      };

      const provider = new AWSSMSProvider(config);

      await expect(provider.sendOTP('+61499453412', '123456')).rejects.toThrow(
        'AWS End User Messaging SMS delivery failed',
      );
    });

    it('should map protect configuration block to user-facing message', async () => {
      const awsError =
        'Conflict Occurred - Reason="DESTINATION_COUNTRY_BLOCKED_BY_PROTECT_CONFIGURATION" ResourceType="protect-configuration" ResourceId="protect-xxx"';
      mockEndUserMessagingSend.mockRejectedValueOnce(new Error(awsError));

      const config: AWSSMSConfig = {
        region: 'ap-southeast-2',
        originationNumber: 'anyspaces',
        apiMode: 'end-user-messaging-sms',
      };

      const provider = new AWSSMSProvider(config);

      await expect(provider.sendOTP('+61499453412', '123456')).rejects.toThrow(
        'destination country is blocked by your AWS protect configuration',
      );
    });
  });

  // ============================================================================
  // Template Engine Tests
  // ============================================================================

  describe('setTemplateEngine', () => {
    it('should use template engine for message rendering', async () => {
      const config: AWSSMSConfig = {
        region: 'us-east-1',
        originationNumber: '+12345678901',
        apiMode: 'sns',
      };

      const provider = new AWSSMSProvider(config);

      const mockEngine = {
        render: jest.fn().mockResolvedValue({
          content: 'Your code is 123456. Valid for 5 minutes.',
        }),
      };

      provider.setTemplateEngine(mockEngine as any);
      provider.setGlobalVariables({ appName: 'TestApp' });

      await provider.sendOTP('+19876543210', '123456', 'verification', { expiryMinutes: 5 });

      expect(mockEngine.render).toHaveBeenCalledWith('verification', {
        appName: 'TestApp',
        code: '123456',
        expiryMinutes: 5,
      });

      expect(MockPublishCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Message: 'Your code is 123456. Valid for 5 minutes.',
        }),
      );
    });

    it('should fall back to default message on template rendering error', async () => {
      const config: AWSSMSConfig = {
        region: 'us-east-1',
        originationNumber: '+12345678901',
        apiMode: 'sns',
      };

      const provider = new AWSSMSProvider(config);

      const mockEngine = {
        render: jest.fn().mockRejectedValue(new Error('Template not found')),
      };

      provider.setTemplateEngine(mockEngine as any);

      await provider.sendOTP('+19876543210', '123456', 'verification');

      expect(MockPublishCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Message: 'Your verification code is: 123456',
        }),
      );
    });
  });

  // ============================================================================
  // sendVerificationCode Tests
  // ============================================================================

  describe('sendVerificationCode', () => {
    it('should be an alias for sendOTP', async () => {
      const config: AWSSMSConfig = {
        region: 'us-east-1',
        originationNumber: '+12345678901',
        apiMode: 'sns',
      };

      const provider = new AWSSMSProvider(config);
      await provider.sendVerificationCode('+19876543210', '999888');

      expect(MockPublishCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Message: 'Your verification code is: 999888',
        }),
      );
    });
  });
});
