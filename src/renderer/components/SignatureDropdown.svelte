<script>
  import { fade, scale } from 'svelte/transition';

  let {
    signatures = [],
    isOpen = false,
    onSelect = () => {},
    onDelete = () => {},
    onCreateNew = () => {},
    onClose = () => {},
  } = $props();

  let container = $state(null);
  let confirmingDeleteId = $state(null);

  $effect(() => {
    if (!isOpen) confirmingDeleteId = null;
  });

  function handleClickOutside(event) {
    if (container && !container.contains(event.target)) {
      onClose();
    }
  }

  $effect(() => {
    if (isOpen) {
      document.addEventListener('click', handleClickOutside, true);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  });

  $effect(() => {
    if (!isOpen) return;

    function handleDocKeydown(e) {
      if (e.key === 'Escape') {
        onClose?.();
      }
    }

    document.addEventListener('keydown', handleDocKeydown);
    return () => document.removeEventListener('keydown', handleDocKeydown);
  });

  function handleCreateNew() {
    onCreateNew?.();
    onClose?.();
  }

  function handleSelect(signature) {
    onSelect?.(signature);
    onClose?.();
  }

  function requestDelete(id, event) {
    event.stopPropagation();
    confirmingDeleteId = id;
  }

  function confirmDelete(id, event) {
    event.stopPropagation();
    onDelete?.(id);
    confirmingDeleteId = null;
  }

  function cancelDelete(event) {
    event.stopPropagation();
    confirmingDeleteId = null;
  }
</script>

{#if isOpen}
  <div bind:this={container} transition:scale={{ start: 0.95, duration: 120 }} class="absolute z-50 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[250px] max-w-[300px] mt-1">
    <button
      onclick={handleCreateNew}
      class="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-t-lg transition-colors"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
      </svg>
      Create New Signature
    </button>

    {#if signatures.length > 0}
      <div class="border-t border-gray-200"></div>

      <div class="max-h-[220px] overflow-y-auto">
        {#each signatures as signature (signature.id)}
          <div class="group flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer relative" onclick={() => handleSelect(signature)} role="button" tabindex="0" onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(signature); } }}>
            {#if confirmingDeleteId === signature.id}
              <div class="flex items-center gap-1 w-full" onclick={cancelDelete} role="button" tabindex="0" onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cancelDelete(e); } }}>
                <span class="text-xs text-red-600 font-medium">Delete?</span>
                <button onclick={(e) => confirmDelete(signature.id, e)} class="text-xs text-red-600 font-semibold hover:text-red-700">Yes</button>
                <button onclick={cancelDelete} class="text-xs text-gray-500 font-medium hover:text-gray-700">No</button>
              </div>
            {:else}
              <div class="w-[50px] h-[30px] shrink-0 rounded overflow-hidden" style="background: repeating-conic-gradient(#e5e7eb 0% 25%, transparent 0% 50%) 50% / 8px 8px;">
                {#if signature.imageData}
                  <img src={signature.imageData} alt={signature.name} class="w-full h-full object-contain" />
                {/if}
              </div>
              <span class="text-sm text-gray-700 truncate flex-1">{signature.name}</span>
              <button onclick={(e) => requestDelete(signature.id, e)} class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all ml-auto shrink-0" title="Delete signature">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <div class="border-t border-gray-200"></div>
      <div class="px-3 py-3 text-xs text-gray-400 text-center">
        No signatures yet. Create one!
      </div>
    {/if}
  </div>
{/if}
