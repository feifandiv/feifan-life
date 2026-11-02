export function vaultRelativePath(input: string, allowEmpty = false): string {
  const value = input.trim().replace(/\\/g, '/');
  if (!value && allowEmpty) return '';
  if (!value || value.startsWith('/') || /[:\u0000-\u001f]/.test(value)) {
    throw new Error('请填写当前知识库内的相对路径');
  }
  const parts = value.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || part.startsWith('.'))) {
    throw new Error('路径不能包含隐藏目录、空目录或上级目录');
  }
  return parts.join('/');
}

export function storagePaths(configDir: string, pluginId: string) {
  const config = configDir.replace(/\\/g, '/').replace(/\/$/, '');
  if (!config || config.startsWith('/') || /[:\u0000-\u001f]/.test(config)
    || config.split('/').some(part => !part || part === '.' || part === '..')
    || !/^[a-z]+(?:-[a-z]+)*$/.test(pluginId)) {
    throw new Error('Invalid plugin storage location');
  }
  const dataDir = config + '/plugins/' + pluginId;
  const backupDir = dataDir + '/backups';
  return {
    dataDir, dataPath: dataDir + '/data.json', backupDir,
    dailyBackupDir: backupDir + '/daily', writeBackupDir: backupDir + '/before-write',
  };
}
