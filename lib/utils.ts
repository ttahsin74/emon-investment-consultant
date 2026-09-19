export const money = (value: number | null | undefined) => `৳${Number(value || 0).toLocaleString('en-BD')}`;
export const shortDate = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';

export const statuses = [
  'New Inquiry',
  'Site Visit Scheduled',
  'Site Visit Done',
  'Offer Sent',
  'Negotiation',
  'Loan / Finance',
  'Documentation',
  'Ready to Close',
  'Closed Won',
  'Closed Lost'
];

export const dealTypes = ['Buy', 'Sell', 'Rent', 'Investment', 'Commercial'];
export const propertyTypes = ['Apartment', 'Villa', 'Plot', 'Commercial Space', 'Office', 'Land', 'Townhouse'];
export const sources = ['Facebook Ads', 'Website', 'Referral', 'Google Maps', 'Instagram', 'Cold Call', 'Other'];
export const followupTypes = ['Call', 'WhatsApp', 'Email', 'Site Visit', 'Meeting', 'Other'];

export const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Dhaka', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
