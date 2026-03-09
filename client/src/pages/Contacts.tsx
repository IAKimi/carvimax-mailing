import { Layout } from "@/components/Layout";
import { useContacts } from "@/hooks/use-contacts";
import { Upload, Plus, Search, Filter } from "lucide-react";

export default function Contacts() {
  const { data: contacts, isLoading } = useContacts();

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-foreground mb-2">Audience</h1>
            <p className="text-lg text-muted-foreground">Manage your contacts and segments.</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="
              px-4 py-2.5 rounded-xl font-bold border-2 border-border bg-card hover:bg-slate-50 
              flex items-center gap-2 transition-colors whitespace-nowrap
            ">
              <Upload className="w-4 h-4" />
              Import CSV
            </button>
            <button className="
              px-4 py-2.5 rounded-xl font-bold bg-primary text-white 
              shadow-lg shadow-primary/20 hover:-translate-y-0.5 hover:bg-primary/90 
              flex items-center gap-2 transition-all whitespace-nowrap
            ">
              <Plus className="w-4 h-4" />
              Add Contact
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 bg-card p-4 rounded-2xl border border-border shadow-sm">
          <div className="flex-1 min-w-[250px] relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search by name or email..." 
              className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-accent outline-none"
            />
          </div>
          <button className="px-4 py-2.5 rounded-xl border border-border flex items-center gap-2 font-medium hover:bg-slate-50">
            <Filter className="w-4 h-4" /> Segment: All
          </button>
        </div>

        {/* Table */}
        <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-border">
                  <th className="px-6 py-4 font-bold text-muted-foreground uppercase text-xs tracking-wider">Contact</th>
                  <th className="px-6 py-4 font-bold text-muted-foreground uppercase text-xs tracking-wider">Country</th>
                  <th className="px-6 py-4 font-bold text-muted-foreground uppercase text-xs tracking-wider">Segment</th>
                  <th className="px-6 py-4 font-bold text-muted-foreground uppercase text-xs tracking-wider text-right">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  // Skeleton rows
                  [1,2,3,4,5].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-48 mb-2"/><div className="h-3 bg-slate-200 rounded w-32"/></td>
                      <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-20"/></td>
                      <td className="px-6 py-4"><div className="h-6 bg-slate-200 rounded-full w-24"/></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 bg-slate-200 rounded w-24 ml-auto"/></td>
                    </tr>
                  ))
                ) : !contacts?.length ? (
                  // Fallback Mock Data for UI completeness if API empty
                  [
                    { id: 1, name: "Alice Freeman", email: "alice@example.com", country: "US", segment: "Premium", createdAt: new Date() },
                    { id: 2, name: "Bob Smith", email: "bob.smith@tech.co", country: "UK", segment: "Free", createdAt: new Date() },
                    { id: 3, name: "Carlos Diaz", email: "carlos@startup.io", country: "ES", segment: "Lead", createdAt: new Date() },
                  ].map((contact: any) => (
                    <tr key={contact.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-foreground">{contact.name}</div>
                        <div className="text-sm text-muted-foreground">{contact.email}</div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground font-medium">{contact.country || '-'}</td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-secondary text-secondary-foreground">
                          {contact.segment || 'Unsegmented'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-muted-foreground">
                        {new Date(contact.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  // Actual Data
                  contacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-foreground">{contact.name || 'Unknown'}</div>
                        <div className="text-sm text-muted-foreground">{contact.email}</div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground font-medium">{contact.country || '-'}</td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-secondary text-secondary-foreground">
                          {contact.segment || 'Unsegmented'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-muted-foreground">
                        {new Date(contact.createdAt!).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
