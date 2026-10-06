import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { DeleteUserDialog } from '@/features/users/components/delete-user-dialog';

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
// The dialog imports the server actions module for its result type only.
jest.mock('@/features/users/actions', () => ({}));

function renderDialog(onConfirm = jest.fn().mockResolvedValue({ ok: true, message: 'Account deleted and anonymized' })) {
  const onOpenChange = jest.fn();
  render(<DeleteUserDialog email="jane@example.com" open onOpenChange={onOpenChange} onConfirm={onConfirm} />);
  return { onConfirm, onOpenChange };
}

describe('DeleteUserDialog', () => {
  it('only enables deletion once the email is typed exactly', async () => {
    const user = userEvent.setup();
    renderDialog();
    const button = screen.getByRole('button', { name: 'Delete account' });

    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText(/to confirm/), 'jane@example');
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText(/to confirm/), '.com');
    expect(button).toBeEnabled();
  });

  it('deletes, shows a toast and closes on success', async () => {
    const user = userEvent.setup();
    const { onConfirm, onOpenChange } = renderDialog();

    await user.type(screen.getByLabelText(/to confirm/), 'JANE@example.com');
    await user.click(screen.getByRole('button', { name: 'Delete account' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Account deleted and anonymized');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps the dialog open and shows the API error on failure', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog(jest.fn().mockResolvedValue({ ok: false, error: 'At least one active admin is required' }));

    await user.type(screen.getByLabelText(/to confirm/), 'jane@example.com');
    await user.click(screen.getByRole('button', { name: 'Delete account' }));

    expect(toast.error).toHaveBeenCalledWith('At least one active admin is required');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
