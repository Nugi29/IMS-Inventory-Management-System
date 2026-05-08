import { useContext, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { useUserProfile } from '../services/useUserProfile'

export const UserProfile = () => {
    const { userData, loadUserProfileData, logout } = useContext(AppContext)
    const { updateUserProfile } = useUserProfile()
    const navigate = useNavigate()
    const [formData, setFormData] = useState({
        id: '',
        username: '',
        name: '',
        password: '',
        confirmPassword: '',
        roleName: '',
        statusName: '',
        createdAt: '',
    })
    const [showPasswordFields, setShowPasswordFields] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    const formatCreatedDate = (value) => {
        if (!value) return ''

        const date = new Date(value)
        if (Number.isNaN(date.getTime())) {
            return ''
        }

        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        })
    }

    const getCreatedAtValue = (profile) =>
        profile?.createdAt ?? profile?.created_at ?? profile?.created_date ?? profile?.createdDate

    useEffect(() => {
        if (userData) {
            setFormData((prev) => ({
                ...prev,
                id: userData.id || userData.user_id || userData._id || '',
                username: userData.username || '',
                name: userData.name || '',
                roleName: userData.role?.name || userData.role_name || userData.role || '',
                statusName: userData.user_status?.name || userData.status || userData.user_status || '',
                createdAt: formatCreatedDate(getCreatedAtValue(userData)),
            }))
        }
    }, [userData])

    const handleChange = (event) => {
        const { name, value } = event.target
        setFormData((prev) => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (event) => {
        event.preventDefault()

        if (!formData.name.trim() || !formData.username.trim()) {
            toast.error('Name and username are required')
            return
        }

        if (formData.password && formData.password !== formData.confirmPassword) {
            toast.error('Password confirmation does not match')
            return
        }

        const id = formData.id
        if (!id) {
            toast.error('Missing user profile id')
            return
        }

        const payload = {
            id,
            name: formData.name.trim(),
            username: formData.username.trim(),
            password: formData.password,
        }

        setIsSaving(true)
        try {
            const response = await updateUserProfile(payload)

            if (response.success) {
                const usernameChanged = formData.username !== (userData?.username || '')
                const passwordChanged = Boolean(formData.password)

                toast.success(response.message || 'Profile updated successfully')
                setFormData((prev) => ({ ...prev, password: '', confirmPassword: '' }))

                if (passwordChanged || usernameChanged) {
                    toast.info('You will be logged out after this update.')
                    logout()
                    return
                }

                await loadUserProfileData()
                return
            }

            toast.error(response.message || 'Unable to update profile')
        } catch (error) {
            toast.error(error?.message || 'Unable to update profile')
        } finally {
            setIsSaving(false)
        }
    }

    const fields = useMemo(
        () => [
            {
                label: 'User ID',
                value: formData.id,
                name: 'id',
                readOnly: true,
            },
            {
                label: 'Role',
                value: formData.roleName,
                name: 'roleName',
                readOnly: true,
            },
            {
                label: 'Status',
                value: formData.statusName,
                name: 'statusName',
                readOnly: true,
            },
            {
                label: 'Created Date',
                value: formData.createdAt,
                name: 'createdAt',
                readOnly: true,
            },
        ],
        [formData.id, formData.roleName, formData.statusName, formData.createdAt]
    )

    if (!userData) {
        return (
            <main className="ml-0 mt-0 p-4 sm:p-6 lg:p-8 min-h-screen">
                <div className="rounded-3xl border border-slate-200 bg-white/90 p-8 text-center text-slate-600 shadow-sm">
                    Loading profile...
                </div>
            </main>
        )
    }

    return (
        <main className=" bg-gradient-to-br from-slate-100 via-white to-blue-50 p-4 sm:p-6">
            <section className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                            User Profile
                        </h1>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                        Cancel
                    </button>
                </header>

                {/* FORM */}
                <form className="space-y-6 px-6 py-6" onSubmit={handleSubmit}>

                    {/* BASIC INFO */}
                    <div className="grid gap-5 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                Username
                            </label>
                            <input
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm 
                  focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                Full Name
                            </label>
                            <input
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm 
                  focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                            />
                        </div>
                    </div>

                    {/* PASSWORD TOGGLE */}
                    <div>
                        <button
                            type="button"
                            onClick={() => setShowPasswordFields((prev) => !prev)}
                            className="text-sm font-medium text-blue-600 hover:underline"
                        >
                            {showPasswordFields ? 'Cancel password change' : 'Change password'}
                        </button>
                    </div>

                    {/* PASSWORD FIELDS */}
                    {showPasswordFields && (
                        <div className="grid gap-5 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase">
                                    New Password
                                </label>
                                <input
                                    name="password"
                                    type="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm 
                    focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase">
                                    Confirm Password
                                </label>
                                <input
                                    name="confirmPassword"
                                    type="password"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm 
                    focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                                />
                            </div>
                        </div>
                    )}

                    {/* META INFO */}
                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5">
                        <h3 className="text-sm font-semibold text-slate-700 mb-4">
                            Account Information
                        </h3>

                        <div className="grid gap-4 sm:grid-cols-2">
                            {fields.map((field) => (
                                <div key={field.name}>
                                    <p className="text-xs text-slate-500 mb-1">{field.label}</p>
                                    <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-slate-700">
                                        {field.value || '-'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ACTIONS */}
                    <div className="flex items-center justify-end border-t border-slate-100 pt-6">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white 
                shadow-md hover:shadow-lg transition disabled:opacity-60"
                        >
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </section>
        </main>
    )
}
