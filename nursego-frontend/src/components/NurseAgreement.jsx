import React, { useState } from 'react';

export default function NurseAgreement({ agreed, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginBottom: 16 }}>
      {/* ხელშეკრულების ჩვენება */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none', border: 'none', color: 'var(--primary)',
          fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
          padding: 0, fontFamily: 'inherit', marginBottom: 10,
        }}
      >
        📄 {open ? 'ხელშეკრულების დახურვა ▲' : 'სამომსახურო ხელშეკრულება — წაიკითხე ▼'}
      </button>

      {open && (
        <div style={{
          background: '#f8fafc', border: '1.5px solid #e2e8f0',
          borderRadius: 12, padding: '16px 18px', fontSize: 13,
          color: '#334155', lineHeight: 1.7, maxHeight: 320,
          overflowY: 'auto', marginBottom: 12,
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12, color: '#0f172a' }}>
            MyNurse — ექთნის სამომსახურო შეთანხმება
          </h3>

          <p><strong>1. ზოგადი დებულებები</strong></p>
          <p>
            წინამდებარე შეთანხმება იდება MyNurse პლატფორმასა (შემდგომ „პლატფორმა") და
            რეგისტრირებულ ექთანს (შემდგომ „სპეციალისტი") შორის. რეგისტრაციით სპეციალისტი
            ადასტურებს, რომ გაეცნო და ეთანხმება ყველა ქვემოთ მოცემულ პირობას.
          </p>

          <p><strong>2. პლატფორმის გამოყენება</strong></p>
          <p>
            სპეციალისტი ვალდებულია გამოიყენოს MyNurse-ის კომუნიკაციის არხები (ჩეთი, ზარი)
            მომხმარებლებთან ურთიერთობისთვის. <strong>პლატფორმის გვერდის ავლით პირდაპირი
            კონტაქტის დამყარება (ტელეფონის ნომრის, სოციალური ქსელის ან სხვა საკონტაქტო
            ინფორმაციის გაცვლა) კატეგორიულად აკრძალულია.</strong>
          </p>

          <p><strong>3. პასუხისმგებლობა</strong></p>
          <p>
            სპეციალისტი პასუხისმგებელია გაწეული მომსახურების ხარისხზე. ნებისმიერი
            შეცდომა, დაგვიანება ან კლიენტის ჯანმრთელობის ზიანი — სრულად სპეციალისტის
            პირად პასუხისმგებლობას წარმოადგენს. პლატფორმა მხოლოდ შუამავლის ფუნქციას
            ასრულებს.
          </p>

          <p><strong>4. კომისია და ანაზღაურება</strong></p>
          <p>
            პლატფორმა ინარჩუნებს შეკვეთის ღირებულების <strong>20%-ს</strong> საკომისიოდ.
            სპეციალისტი იღებს <strong>80%-ს</strong>. ანაზღაურება ხდება ყოველ კვირა,
            წინა კვირის განმავლობაში დასრულებული შეკვეთების მიხედვით.
          </p>

          <p><strong>5. შეზღუდვები</strong></p>
          <ul style={{ paddingLeft: 18 }}>
            <li>იკრძალება მომხმარებელთან პლატფორმის გარეთ მომსახურების გაწევა;</li>
            <li>იკრძალება პლატფორმაზე მიღებული კლიენტების მოზიდვა სხვა სერვისებზე;</li>
            <li>იკრძალება კლიენტის პერსონალური მონაცემების გასაჯაროება;</li>
            <li>იკრძალება ყალბი ან შეცდომაში შემყვანი ინფორმაციის მიწოდება.</li>
          </ul>

          <p><strong>6. სანქციები</strong></p>
          <p>
            წინამდებარე შეთანხმების დარღვევის შემთხვევაში პლატფორმა უფლებამოსილია
            ანგარიში <strong>დაუყოვნებლივ დაბლოკოს</strong> გამარჯვებული შეკვეთების
            ანაზღაურების გარეშე. განმეორებითი დარღვევის შემთხვევაში — სამართლებრივი
            ზომები კანონმდებლობის შესაბამისად.
          </p>

          <p><strong>7. კონფიდენციალობა</strong></p>
          <p>
            პლატფორმა იცავს სპეციალისტის პერსონალურ მონაცემებს საქართველოს კანონმდებლობის
            შესაბამისად და მათ მესამე პირებს არ გადასცემს სასამართლოს მოთხოვნის გარეშე.
          </p>

          <p><strong>8. შეთანხმების ცვლილება</strong></p>
          <p>
            პლატფორმა უფლებამოსილია შეცვალოს წინამდებარე პირობები 14-დღიანი
            წინასწარი შეტყობინებით. გამოყენების გაგრძელება ნიშნავს ახალი პირობების
            მიღებას.
          </p>

          <p style={{ marginTop: 12, color: '#64748b', fontSize: 12 }}>
            ბოლო განახლება: 2025 წლის ივნისი · MyNurse Georgia
          </p>
        </div>
      )}

      {/* Checkbox */}
      <label style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        cursor: 'pointer', fontSize: 13, color: '#334155', lineHeight: 1.5,
      }}>
        <input
          type="checkbox"
          checked={agreed}
          onChange={e => onChange(e.target.checked)}
          style={{ marginTop: 3, width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
        />
        <span>
          წავიკითხე და ვეთანხმები{' '}
          <button type="button" onClick={() => setOpen(true)}
            style={{ background: 'none', border: 'none', color: 'var(--primary)',
              textDecoration: 'underline', cursor: 'pointer', padding: 0,
              fontFamily: 'inherit', fontSize: 13 }}>
            სამომსახურო ხელშეკრულებას
          </button>
          {' '}და პლატფორმის წესებს.
        </span>
      </label>
    </div>
  );
}
