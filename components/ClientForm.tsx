'use client';
import { statuses, sources, dealTypes, propertyTypes } from '@/lib/utils';
import { closedLeadStatus } from '@/lib/followups';

export default function ClientForm({ client, onStatusChange }: { client?: any; onStatusChange?: (status: string) => void }) {
  return (
    <div className="form-grid">
      <div className="field">
        <label htmlFor="name">Client Name *</label>
        <input className="input" id="name" name="name" defaultValue={client?.name || ''} placeholder="e.g. Arif Rahman" required />
      </div>

      <div className="field">
        <label htmlFor="profession">Profession</label>
        <input className="input" id="profession" name="profession" defaultValue={client?.profession || ''} placeholder="e.g. Business owner, Engineer" />
      </div>

      <div className="field">
        <label htmlFor="deal_type">Deal Type</label>
        <select className="select" id="deal_type" name="deal_type" defaultValue={client?.deal_type || 'Buy'}>
          {dealTypes.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="phone">Phone *</label>
        <input className="input" id="phone" name="phone" defaultValue={client?.phone || ''} placeholder="01XXXXXXXXX" required />
      </div>

      <div className="field">
        <label htmlFor="alt_phone">Alternative Phone</label>
        <input className="input" id="alt_phone" name="alt_phone" defaultValue={client?.alt_phone || ''} />
      </div>

      <div className="field">
        <label htmlFor="email">Email</label>
        <input className="input" type="email" id="email" name="email" defaultValue={client?.email || ''} placeholder="client@email.com" />
      </div>

      <div className="field">
        <label htmlFor="preferred_location">Preferred Location</label>
        <input className="input" id="preferred_location" name="preferred_location" defaultValue={client?.preferred_location || ''} placeholder="e.g. Gulshan, Dhanmondi" />
      </div>

      <div className="field">
        <label htmlFor="property_type">Property Type</label>
        <select className="select" id="property_type" name="property_type" defaultValue={client?.property_type || ''}>
          <option value="">Select property</option>
          {propertyTypes.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="source">Source</label>
        <select className="select" id="source" name="source" defaultValue={client?.source || 'Website'}>
          {sources.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="status">Progress Stage</label>
        <select className="select" id="status" name="status" defaultValue={closedLeadStatus(client?.status || '') || client?.status || 'New Inquiry'} onChange={(event) => onStatusChange?.(event.target.value)}>
          {statuses.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="interested_service">Interested Property</label>
        <input className="input" id="interested_service" name="interested_service" defaultValue={client?.interested_service || ''} placeholder="2 BHK apartment, office space, land..." />
      </div>

      <div className="field">
        <label htmlFor="budget">Budget</label>
        <input className="input" type="number" step="0.01" min="0" id="budget" name="budget" defaultValue={client?.budget || 0} placeholder="0" />
      </div>

      <div className="field">
        <label htmlFor="budget_range">Budget Range</label>
        <input className="input" id="budget_range" name="budget_range" defaultValue={client?.budget_range || ''} placeholder="৳50L - ৳70L" />
      </div>

      <div className="field">
        <label htmlFor="closing_date">Expected Closing Date</label>
        <input className="input" type="date" id="closing_date" name="closing_date" defaultValue={client?.closing_date || ''} />
      </div>

      <div className="field">
        <label htmlFor="company">Company / Developer</label>
        <input className="input" id="company" name="company" defaultValue={client?.company || ''} placeholder="Optional" />
      </div>

      <div className="field">
        <label htmlFor="address">Address</label>
        <input className="input" id="address" name="address" defaultValue={client?.address || ''} placeholder="Current address" />
      </div>

      <div className="field span2">
        <label htmlFor="progress_note">Current Progress Note</label>
        <textarea className="textarea" id="progress_note" name="progress_note" defaultValue={client?.progress_note || ''} placeholder="Short summary of the current deal stage, requirements, or next action." />
      </div>

      <div className="field span2">
        <label htmlFor="notes">Notes</label>
        <textarea className="textarea" id="notes" name="notes" defaultValue={client?.notes || ''} placeholder="Extra details, preferences, requirements, or historical notes." />
      </div>

      <div className="field">
        <label htmlFor="website">Website</label>
        <input className="input" id="website" name="website" defaultValue={client?.website || ''} placeholder="https://" />
      </div>

      <div className="field">
        <label htmlFor="facebook">Facebook</label>
        <input className="input" id="facebook" name="facebook" defaultValue={client?.facebook || ''} placeholder="https://facebook.com" />
      </div>

      <div className="field span2">
        <label htmlFor="linkedin">LinkedIn</label>
        <input className="input" id="linkedin" name="linkedin" defaultValue={client?.linkedin || ''} placeholder="https://linkedin.com" />
      </div>
    </div>
  );
}
