import { HomeLayout } from 'fumadocs-ui/layouts/home';
import Link from 'next/link';
import { baseOptions } from '../../lib/layout';
import RepositoryCommands from '../../components/repository-commands';
export const metadata = { title: 'Check a repository' };
export default function RepositoriesPage() {
  return <HomeLayout {...baseOptions}><main className="landing utility-page"><h1>Check a repository</h1><p>Enter a Git repository and copy the commands to verify its Momento commit proofs on your computer.</p><RepositoryCommands /><p><Link href="/docs/git">How Git verification works →</Link></p></main></HomeLayout>;
}
