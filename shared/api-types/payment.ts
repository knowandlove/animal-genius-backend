// Payment-related API types

export interface CreateCheckoutSessionRequest {
  classId: string;
  studentCount: number;
}

export interface CreateCheckoutSessionResponse {
  success: boolean;
  data?: {
    sessionId: string;
    mockCheckoutUrl: string;
  };
  error?: string;
}

export interface MockWebhookRequest {
  sessionId: string;
  status: 'success' | 'failure';
}

export interface MockWebhookResponse {
  success: boolean;
  data?: {
    redirectUrl: string;
  };
  error?: string;
}

export interface PaymentStatusResponse {
  success: boolean;
  data?: {
    paymentId: string;
    status: 'pending' | 'succeeded' | 'failed' | 'refunded';
    classId: string;
    className: string;
    studentCount: number;
    amountCents: number;
    paidAt?: string;
  };
  error?: string;
}
