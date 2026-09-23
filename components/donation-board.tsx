import donations from "@/config/donations.json";

const donationUrl = "https://donation.base31.org";

type Donation = {
  name: string;
  amount: number;
  message?: string;
  show?: boolean;
};

export default function DonationBoard() {
  const visibleDonations = (donations as Donation[]).filter(
    (donation) => donation.show !== false && donation.name.trim() && donation.amount > 0,
  );
  const total = visibleDonations.reduce((sum, donation) => sum + donation.amount, 0);

  return (
    <aside className="donation-board" data-reveal aria-label="Donation board">
      <div className="donation-board-topline" aria-hidden="true" />
      <div className="donation-head">
        <span className="donation-spark" aria-hidden="true">✦</span>
        <span>Supporters</span>
        <span className="donation-live mono">live</span>
      </div>
      <div className="donation-total">
        <span className="donation-total-label mono">community support</span>
        <strong>${total.toFixed(2)}</strong>
      </div>
      {visibleDonations.length > 0 ? (
        <ul className="donation-list">
          {visibleDonations.slice(0, 5).map((donation) => (
            <li key={`${donation.name}-${donation.amount}`} className="donation-entry">
              <span className="donation-entry-copy">
                <strong>{donation.name}</strong>
                {donation.message && <small>{donation.message}</small>}
              </span>
              <span className="donation-amount mono">${donation.amount.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="donation-empty">Be the first supporter.</p>
      )}
      <a className="donation-cta" href={donationUrl} target="_blank" rel="noreferrer">
        Support base31 <span aria-hidden="true">↗</span>
      </a>
    </aside>
  );
}
