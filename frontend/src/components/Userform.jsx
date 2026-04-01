import { useLocation, useNavigate } from 'react-router-dom'

export const Userform = () => {
    const navigate = useNavigate()
    const location = useLocation()

    const mode = location.state?.mode === 'update' ? 'update' : 'add'
    const selectedUser = location.state?.user

    return (
        <main className="min-h-screen p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                            User Management
                        </p>
                        <h1 className="mt-2 text-2xl font-bold text-slate-900">
                            {mode === 'add' ? 'Add New User' : 'Update User'}
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            {mode === 'add'
                                ? 'Create a new user record.'
                                : 'Edit the selected user record.'}
                        </p>
                    </div>
                    <button
                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-primary/40 hover:text-primary"
                        type="button"
                        onClick={() => navigate('/users')}
                    >
                        Back to Users
                    </button>
                </div>

                <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                    Current mode: <span className="font-semibold text-slate-900">{mode}</span>
                    {selectedUser ? (
                        <div className="mt-2">
                            Editing user: <span className="font-semibold text-slate-900">{selectedUser.username}</span>
                        </div>
                    ) : null}
                </div>
            </div>
        </main>
    )
}