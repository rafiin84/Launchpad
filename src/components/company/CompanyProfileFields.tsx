import { Textarea } from '../ui/Input';
import { useLanguage } from '../../context/LanguageContext';
import type { CRMFormFields } from '../../services/crmPortfolio';

type Key = 'businessModel' | 'productsServices' | 'problemStatement' | 'solution' | 'targetMarket' | 'competitiveLandscape' | 'teamInformation';

/** The company-profile text fields the Overview tab shows, as form inputs. */
export default function CompanyProfileFields({ values, onChange }: {
  values: CRMFormFields;
  onChange: (key: Key) => (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  const t = useLanguage().t.companyDetail;
  const rows: Array<[Key, string]> = [
    ['businessModel', t.ovBusinessModel], ['productsServices', t.ovProducts], ['problemStatement', t.ovProblem],
    ['solution', t.ovSolution], ['targetMarket', t.ovTargetMarket], ['competitiveLandscape', t.ovCompetitive],
    ['teamInformation', t.ovTeamInfo],
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {rows.map(([key, label]) => (
        <Textarea key={key} label={label} value={values[key] ?? ''} onChange={onChange(key)} rows={3} />
      ))}
    </div>
  );
}
