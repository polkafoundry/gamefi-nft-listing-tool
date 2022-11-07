import { UploadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { Button, Upload } from 'antd';
import React, { useMemo } from 'react';

const Uploader = ({ onChange }: { onChange: (info: any) => void; }) => {
  const props: UploadProps = useMemo(() => ({
    name: 'file',
    action: '',
    headers: {
      authorization: 'authorization-text',
    },
    multiple: false,
    maxCount: 1,
    accept: '.csv',
    beforeUpload: file => {
      onChange(file)
      return false
    }
  }), [onChange])

  return <Upload {...props}>
  <Button icon={<UploadOutlined />}>Click to Upload CSV</Button>
</Upload>
}

export default Uploader
