type LegalSection = {
  title: string;
  body: string[];
};

type LegalSectionsPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  sections: LegalSection[];
};

export function LegalSectionsPage({
  eyebrow,
  title,
  description,
  sections,
}: LegalSectionsPageProps) {
  return (
    <div className="bg-[#f7f2ea] pb-20">
      <section className="border-b border-[color:var(--line)] bg-[#ece3d5]">
        <div className="page-frame">
          <div className="content-shell py-16 sm:py-20">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[#8d7a5c]">
              {eyebrow}
            </p>
            <h1 className="mt-4 font-display text-[4rem] leading-[0.92] tracking-[-0.05em] text-[#201d17] sm:text-[5.8rem]">
              {title}
            </h1>
            <p className="mt-5 max-w-2xl text-[1rem] leading-8 text-[#5d574f]">
              {description}
            </p>
          </div>
        </div>
      </section>

      <section className="page-frame py-12 sm:py-16">
        <div className="content-shell space-y-6">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-[2rem] bg-white p-7 shadow-[0_18px_50px_rgba(31,28,24,0.05)] sm:p-8"
            >
              <h2 className="text-[1.2rem] font-semibold text-[#201d17]">
                {section.title}
              </h2>
              <div className="mt-4 space-y-4">
                {section.body.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-[0.95rem] leading-7 text-[#5d574f]"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
